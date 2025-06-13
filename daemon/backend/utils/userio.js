const lru = require('lru-cache');
const redis = require("./database").redisClient;
const { merge } = require('lodash');
const utils = require('./utils');
const crypto = require('crypto');
const database = require('./database');

// 配置缓存
const token_userInfo_cache = new lru.LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 60, // 1小时
    allowStale: false
});

// 安全比较函数，防止时序攻击
function secureCompare(a, b) {
    try {
        return crypto.timingSafeEqual(
            Buffer.from(a, 'utf8'),
            Buffer.from(b, 'utf8')
        );
    } catch {
        return false;
    }
}

async function getTokenByPhone(phone, password, newToken) {
    if (!phone || !password) return null;

    try {
        // 获取用户信息（优先本地缓存）
        let cachedUserInfo = token_userInfo_cache.get(phone);
        if (!cachedUserInfo) {
            [cachedUserInfo] = await database.query('SELECT * FROM userInfo WHERE phone = ? LIMIT 1', [phone]);
            if (!cachedUserInfo) {
                // 如果用户信息不存在，创建新用户信息
                cachedUserInfo = { phone, password: utils.hash(password) };
            } else if (!cachedUserInfo.password) {
                // 如果 Redis 中没有密码，使用用户传递的密码
                cachedUserInfo.password = utils.hash(password);
            }
        }

        // 安全验证密码
        if (!secureCompare(cachedUserInfo.password, utils.hash(password))) {
            return null;
        }

        let token;
        if (newToken || !cachedUserInfo.token) {
            // 保存旧token以便清理（如果存在）
            const oldToken = cachedUserInfo.token;

            // 生成新token
            token = utils.generateRandomString(64);

            const updateResult = await database.query(
                `UPDATE userInfo 
             SET password = ?, 
                 token = ?, 
                 token_expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) 
             WHERE phone = ?`,
                [cachedUserInfo.password, token, phone]
            );

            // 更新缓存
            cachedUserInfo.token = token;
            token_userInfo_cache.set(phone, cachedUserInfo);
            token_userInfo_cache.set(token, cachedUserInfo);  // 设置token到userInfo的映射
            if (oldToken) {
                token_userInfo_cache.delete(oldToken);    // 删除旧token映射（如果存在）
            }

            const result = await database.query(
                "UPDATE userInfo SET token_expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE token = ?",
                [token]
            );
        } else {
            // 使用现有token
            token = cachedUserInfo.token;
            if (!token) return getTokenByPhone(phone, password, true);

            const result = await database.query(
                "UPDATE userInfo SET token_expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE token = ?",
                [token]
            );
        }
        return token;
    } catch (err) {
        console.error('getTokenByPhone错误:', err);
        return null;
    }
}

async function readUserInfo(token) {
    if (!token) return null;

    try {
        // 开始事务
        await database.query('START TRANSACTION');

        // 获取用户信息
        let userInfo = token_userInfo_cache.get(token);
        if (!userInfo) {
            [userInfo] = await database.query('SELECT * FROM userInfo WHERE token = ? LIMIT 1', [token]);
            if (!userInfo || Object.keys(userInfo).length === 0) {
                await database.query('ROLLBACK');
                return null;
            }
            token_userInfo_cache.set(token, userInfo);
        }

        // 提交事务
        await database.query('COMMIT');

        // 更新缓存
        token_userInfo_cache.set(token, userInfo);

        return userInfo;
    } catch (err) {
        console.error('readUserInfo错误:', err);
        // 确保在发生错误时回滚事务
        await database.query('ROLLBACK');
        return null;
    }
}

async function writeUserInfo(userInfo, token) {
    if (!userInfo?.phone || !token) return false;

    try {
        const phone = userInfo.phone;

        // 获取现有用户信息
        let cachedUserInfo = token_userInfo_cache.get(phone) || token_userInfo_cache.get(token);
        if (!cachedUserInfo) {
            [cachedUserInfo] = await database.query('SELECT * FROM userInfo WHERE phone = ? LIMIT 1', [phone]);
        }

        // 合并更新
        const updatedInfo = merge(cachedUserInfo || {}, userInfo);

        // 使用事务更新
        try {
            // 开始事务
            await database.query('BEGIN');

            // 更新 Token 表
            await database.query('UPDATE Token SET phone = ? WHERE token = ?', [phone, token]);

            // 更新或插入 UserInfo 表
            await database.query('REPLACE INTO UserInfo (phone, info) VALUES (?, ?)', [phone, JSON.stringify(updatedInfo)]);

            // 提交事务
            await database.query('COMMIT');
        } catch (err) {
            // 回滚事务
            await database.query('ROLLBACK');
            console.error('写入用户信息错误:', err);
            return false;
        }

        // 更新缓存
        token_userInfo_cache.set(phone, updatedInfo);
        token_userInfo_cache.set(token, updatedInfo);

        return true;
    } catch (err) {
        console.error('writeUserInfo错误:', err);
        return false;
    }
}

function refresh() {
    token_userInfo_cache.clear();
    console.log('refresh success.');
}

module.exports = {
    readUserInfo,
    writeUserInfo,
    getTokenByPhone,
    refresh
};
