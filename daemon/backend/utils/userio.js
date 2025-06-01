const lru = require('lru-cache');
const redis = require("./database").redisClient;
const { merge } = require('lodash');
const utils = require('./utils');
const crypto = require('crypto');

// 配置缓存
const token_phone_cache = new lru.LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 60, // 1小时
    allowStale: false
});

const phone_userInfo_cache = new lru.LRUCache({
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
        let cachedUserInfo = phone_userInfo_cache.get(phone);
        if (!cachedUserInfo) {
            cachedUserInfo = await redis.hgetall(`UserInfo::${phone}`);
            if (!cachedUserInfo) {
                // 如果用户信息不存在，创建新用户信息
                cachedUserInfo = { phone, password: utils.hash(password) };
            } else if (!cachedUserInfo.password){
                // 如果 Redis 中没有密码，使用用户传递的密码
                cachedUserInfo.password = utils.hash(password);
            }
        }

        // 如果缓存中没有密码，更新缓存
        if (!cachedUserInfo.password) {
            cachedUserInfo.password = utils.hash(password);
            phone_userInfo_cache.set(phone, cachedUserInfo);
        }

        console.log(cachedUserInfo);

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
            
            // 使用事务保证原子性
            const multi = redis.multi()
                .hSet(`UserInfo::${phone}`, 'password', cachedUserInfo.password)  // 确保密码已设置
                .hSet(`UserInfo::${phone}`, 'token', token)  // 设置新token
                .set(`Token::${token}`, phone, 'EX', 60 * 60 * 24 * 7)  // 创建新token映射
            
            if (oldToken) {
                multi.del(`Token::${oldToken}`);  // 删除旧token映射（如果存在）
            }
            
            await multi.exec();
            
            // 更新缓存
            cachedUserInfo.token = token;
            token_phone_cache.set(token, phone);  // 设置新token映射
            if (oldToken) {
                token_phone_cache.delete(oldToken);    // 删除旧token映射（如果存在）
            }
            phone_userInfo_cache.set(phone, cachedUserInfo);
        } else {
            // 使用现有token
            token = cachedUserInfo.token;
            if (!token) return getTokenByPhone(phone, password, true);
            
            // 续期token
            await redis.set(`Token::${token}`, phone, 'EX', 60 * 60 * 24 * 7);
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
        // 获取手机号
        let phone = token_phone_cache.get(token);
        if (!phone) {
            phone = await redis.get(`Token::${token}`);
            if (!phone) return null;
        }

        // 获取用户信息
        let userInfo = phone_userInfo_cache.get(phone);
        if (!userInfo) {
            userInfo = await redis.hgetall(`UserInfo::${phone}`);
            if (!userInfo || Object.keys(userInfo).length === 0) {
                return null;
            }
        }

        // 验证token匹配
        if (userInfo.token !== token) {
            token_phone_cache.delete(token);
            return null;
        }

        // 更新缓存
        token_phone_cache.set(token, phone);
        phone_userInfo_cache.set(phone, userInfo);
        
        return userInfo;
    } catch (err) {
        console.error('readUserInfo错误:', err);
        return null;
    }
}

async function writeUserInfo(userInfo, token) {
    if (!userInfo?.phone || !token) return false;

    try {
        const phone = userInfo.phone;
        
        // 获取现有用户信息
        let cachedUserInfo = phone_userInfo_cache.get(phone);
        if (!cachedUserInfo) {
            cachedUserInfo = await redis.hgetall(`UserInfo::${phone}`);
        }
        
        // 合并更新
        const updatedInfo = merge(cachedUserInfo || {}, userInfo);
        
        // 使用事务更新
        const multi = redis.multi()
            .set(`Token::${token}`, phone, 'EX', 60 * 60 * 24 * 7)
            .hSet(`UserInfo::${phone}`, updatedInfo);
        
        await multi.exec();
        
        // 更新缓存
        token_phone_cache.set(token, phone);
        phone_userInfo_cache.set(phone, updatedInfo);
        
        return true;
    } catch (err) {
        console.error('writeUserInfo错误:', err);
        return false;
    }
}

function refresh(){
    token_phone_cache.clear();
    phone_userInfo_cache.clear();
    console.log('refresh success.');
}

module.exports = {
    readUserInfo,
    writeUserInfo,
    getTokenByPhone,
    refresh
};
