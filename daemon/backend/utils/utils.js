const crypto = require('crypto');
const path = require('path');

// 检查路径是否在特定文件夹下
function isPathInFolder(filePath, folderPath) {
    const absoluteFilePath = path.resolve(filePath); // 获取文件的绝对路径
    const absoluteFolderPath = path.resolve(folderPath); // 获取目标文件夹的绝对路径

    return absoluteFilePath.startsWith(absoluteFolderPath);
}

function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomBytes = crypto.randomBytes(length);
    return Array.from(randomBytes, byte => charset[byte % charset.length]).join('');
}

function hash(str) {
    return crypto.createHash('sha512').update(str).digest('hex');
}

function getIp(req) {
    return req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : null;
}

module.exports = {
    isPathInFolder,
    generateRandomString,
    hash,
    getIp
};