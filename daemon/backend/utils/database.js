const Redis = require("ioredis");

// 配置对象（可根据环境拆分）
const redisConfig = {
  port: 1145, // Redis 端口
  host: "localhost", // 主机
  // 其他配置：如 db: 0（数据库编号）、retryStrategy（重连策略）
};

// 创建单例客户端（确保只初始化一次）
const redisClient = new Redis(redisConfig);

// 导出客户端实例
module.exports = {redisClient};

