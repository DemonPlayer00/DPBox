const rateLimit = require('express-rate-limit');
const lru = require('lru-cache');
const redis = require("./database.js").redisClient;

const banCache = new lru.LRUCache({
    max: 10000,
    maxAge: 1000 * 60 * 60 // 1 hour
});

// 基础限流配置
const staticLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟窗口
    max: 500, // 每个IP最多500次请求
    standardHeaders: true, // 返回标准RateLimit头部
    legacyHeaders: false, // 禁用旧版头部
    message: 'Yor IP is rate limited. Please try again.',
});
const apiLimiter = rateLimit({   // API限流配置
    windowMs: 1 * 60 * 1000, // 1分钟窗口
    max: 60, // 每个IP最多60次请求
    standardHeaders: true, // 返回标准RateLimit头部
    legacyHeaders: false, // 禁用旧版头部
    message: 'Yor IP is rate limited. Please try again.',
});
const deadLimiter = rateLimit({   // 死链限流配置
    windowMs: 15 * 60 * 1000, // 15分钟窗口
    max: 1650, // 每个IP最多1650次请求
    standardHeaders: true, // 返回标准RateLimit头部
    legacyHeaders: false, // 禁用旧版头部
    message: 'Yor IP is PERPETUALLY BANNED.',
    handler: (req, res) => {
        banCache.set(req.ip, 'permanently', 24 * 60 * 60 * 1000); // 将IP加入黑名单缓存
        redis.set(`Ban::${req.ip}`, 'permanently'); // 将IP加入黑名单
    }
});

// 黑名单检测
async function banstat(ip){
    const stat = banCache.get(ip) || await redis.get(`Ban::${ip}`);
    banCache.set(ip, stat, 24 * 60 * 60 * 1000); // 更新缓存
    return stat;
};

module.exports = {
    staticLimiter,
    apiLimiter,
    deadLimiter,
    banstat
}
