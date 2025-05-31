const express = require('express');
const cors = require('cors');
const Redis = require('redis');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const multer = require('multer');
const utils = require('./utils/utils');
const userio = require('./utils/userio');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const banUtils = require('./utils/banUtils');
const crypto = require('crypto');
const stream = require('stream');
const root = path.relative(__dirname, '../../');

const upload = multer({
  storage: multer.memoryStorage(), // 使用内存存储
  limits: { fileSize: 1024 * 1024 * 1.25 } // 限制1.25MB
});

// 支持分块上传的中间件
const chunkUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'chunkNumber', maxCount: 1 },
  { name: 'totalChunks', maxCount: 1 }
]);

const options = {
  key: fs.readFileSync(`${root}/ssl/DPBox.org.key`),
  cert: fs.readFileSync(`${root}/ssl/DPBox.org.crt`)
}

const redis = Redis.createClient({
  port: 1145,
  host: 'localhost',
  password: '',
  db: 0
});  // 默认连接到 localhost:6379

// 确保 Redis 客户端已连接
redis.connect()
  .then(() => console.log('Redis client connected'))
  .catch((err) => {
    console.error('Failed to connect to Redis:', err);
    process.exit(1);
  });

const app = express();
app.use(async (req, res, next) => {
  const banstat = await banUtils.banstat(req.ip);
  if (banstat) {
    console.log(`Banned IP: ${req.ip}, reason: ${banstat.reason}`);
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Yor IP has been banned, please try again later.', discharge: banstat });
  }
  console.log(`${req.ip}: [${req.method}] ${req.url}`);
  next();
})
app.use(express.static(path.join(root, 'server')));
// 动态选择使用body-parser还是multer
app.use((req, res, next) => {
  if (req.is('application/json')) {
    bodyParser.json()(req, res, next);
  } else if (req.is('multipart/form-data')) {
    chunkUpload(req, res, next);
  } else {
    bodyParser.urlencoded({ extended: true })(req, res, next);
  }
});
app.use(cookieParser());

//app.use(banUtils.apiLimiter);
app.post('/api/user/login', async (req, res) => {
  const { phone, password, newToken } = req.body;
  const token = await userio.getTokenByPhone(phone, password, newToken);
  if (!token) {
    res.status(401).json({ code: 'PHONE_OR_PASSWORD_ERROR', message: '电话或密码错误。' });
  } else {
    res.json({ code: 'SUCCESS', message: '登录成功', token: token });
  }
});

app.use(async (req, res, next) => {
  const token = req.cookies.token;
  console.log(token);
  if (!token) {
    // 改为返回401状态码+数据，而非重定向
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      redirectUrl: '/login.html' // 可选：前端根据此字段跳转
    });
  }
  const userInfo = await userio.readUserInfo(token);
  if (!userInfo) {
    // 改为返回401状态码+数据，而非重定向
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      redirectUrl: '/login.html' // 可选：前端根据此字段跳转
    });
  }
  req.LOCAL = {};
  req.LOCAL.userInfo = userInfo;

  console.log("getUserInfo:", req.LOCAL.userInfo.phone);
  next();
});

app.get('/api/user/getUserInfo', async (req, res) => {
  const password = req.LOCAL.userInfo.password;
  req.LOCAL.userInfo.password = undefined;
  res.json({ code: 'SUCCESS', message: '获取用户信息成功', userInfo: req.LOCAL.userInfo })
  req.LOCAL.userInfo.password = password;
})
app.get('/api/user/getHeadImg', async (req, res) => {
  try {
    const defaultAvatar = path.join(root, '/src/icon/default.svg');
    const avatarPath = path.join(root, '/api/data/userHeads', req.LOCAL.userInfo.phone);

    // 检查文件是否存在且可读
    try {
      await fs.promises.access(avatarPath, fs.constants.R_OK);
      return res.sendFile(avatarPath);
    } catch (err) {
      // 如果头像不存在，返回默认头像
      return res.sendFile(defaultAvatar);
    }
  } catch (err) {
    console.error('获取头像失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});
app.post('/api/user/updateUserInfo', async (req, res) => {
  const { phone, password, name, headImg } = req.body;
  if (phone !== req.LOCAL.userInfo.phone)
    await userio.write()
});
app.get('/api/user/getServices', async (req, res) => {
  let services = await redis.hGetAll(`permission::${req.LOCAL.userInfo.permission}`) || {};
  res.json({ code: 'SUCCESS', message: '获取服务列表成功', services: services });
})
app.use('/api/service/cloudDrive/io{/*path}', async (req, res, next) => {
  const qpath = req.query.path;
  const qroot = path.join(root, `/api/data/userCloud/${req.LOCAL.userInfo.resid}/`)
  if (!qpath) return res.status(400).json({ code: 'BAD_REQUEST', message: '缺少参数' });
  const filePath = path.join(qroot, qpath);
  if (!utils.isPathInFolder(filePath, qroot) || !fs.existsSync(filePath)) return res.status(403).json({ code: 'FORBIDDEN', message: '禁止访问' });

  req.LOCAL.path = filePath;
  next();
})
app.get('/api/service/cloudDrive/io/ls', async (req, res) => {
  const filePath = req.LOCAL.path;

  const files = fs.readdirSync(filePath);
  let result = [];
  files.forEach(file => {
    const stats = fs.statSync(path.join(filePath, file));
    result.push({
      name: file,
      type: stats.isFile() ? 'file' : 'dir',
      size: stats.size,
      mtime: stats.mtimeMs
    });
  });

  res.json({ code: 'SUCCESS', message: '获取文件列表成功', files: result });
})
app.get('/api/service/cloudDrive/io/stat', async (req, res) => {
  const filePath = req.LOCAL.path;
  fs.promises.stat(filePath).then((stat, err) => {
    if (err) {
      return res.json({ code: 'NOT_FOUND', message: '文件不存在' });
    }
    res.json({
      code: 'SUCCESS', message: '文件存在', stat: {
        name: stat.name,
        type: stat.isFile() ? 'file' : 'dir',
        size: stat.size,
        mtime: stat.mtimeMs
      }
    });
  });
})

app.get('/api/service/cloudDrive/io/download', async (req, res) => {
  console.log(`Download: phone=${req.LOCAL.userInfo.phone}, path=${req.query.path},ip=${req.ip}`);
  const filePath = req.LOCAL.path;
  const fileName = path.basename(filePath);
  const rateLimit = 1024 * 100; // 默认限制为100KB/s
  
  // 标记响应是否已发送
  let headersSent = false;
  
  // 封装发送错误响应的函数，确保只发送一次
  const sendError = (statusCode, message) => {
    if (!headersSent) {
      headersSent = true;
      res.status(statusCode).send(message);
    }
  };

  try {
    // 获取文件状态信息
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // 获取请求头中的Range信息
    const range = req.headers.range;

    // 创建文件流
    let fileStream;
    let responseHeaders;
    let statusCode = 200;

    if (range) {
      // 处理断点续传
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      fileStream = fs.createReadStream(filePath, { start, end });
      
      responseHeaders = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=${encodeURIComponent(fileName)}`,
        "X-Rate-Limit": `${rateLimit / 1024} KB/s`
      };
      
      statusCode = 206;
    } else {
      // 普通下载
      fileStream = fs.createReadStream(filePath);
      
      responseHeaders = {
        "Content-Length": fileSize,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=${encodeURIComponent(fileName)}`,
        "X-Rate-Limit": `${rateLimit / 1024} KB/s`
      };
    }

    // 创建速率限制流
    const throttle = createThrottleStream(rateLimit);

    // 设置错误处理
    fileStream.on('error', (err) => {
      console.error('文件流错误:', err);
      sendError(500, '下载过程中发生错误');
      
      // 销毁流以防止内存泄漏
      if (fileStream) fileStream.destroy();
      if (throttle) throttle.destroy();
    });

    throttle.on('error', (err) => {
      console.error('速率限制流出错:', err);
      sendError(500, '下载过程中发生错误');
      
      // 销毁流以防止内存泄漏
      if (fileStream) fileStream.destroy();
      if (throttle) throttle.destroy();
    });

    // 监听响应完成事件
    res.on('finish', () => {
      headersSent = true;
    });

    // 监听响应关闭事件
    res.on('close', () => {
      // 客户端提前关闭连接，清理资源
      if (fileStream) fileStream.destroy();
      if (throttle) throttle.destroy();
    });

    // 发送响应头
    res.writeHead(statusCode, responseHeaders);
    headersSent = true;

    // 通过速率限制流传输文件
    fileStream.pipe(throttle).pipe(res);
  } catch (err) {
    console.error('下载错误:', err);
    sendError(500, '下载过程中发生错误');
  }
});
// 创建速率限制流的辅助函数
function createThrottleStream(bytesPerSecond) {
  const THROTTLE_INTERVAL = 100; // 每100ms检查一次速率
  const bytesPerInterval = bytesPerSecond * (THROTTLE_INTERVAL / 1000);
  
  let buffer = [];
  let currentIntervalBytes = 0;
  let lastIntervalTime = Date.now();
  
  return new stream.Transform({
    transform(chunk, encoding, callback) {
      const now = Date.now();
      
      // 如果是新的时间间隔，重置计数器
      if (now - lastIntervalTime > THROTTLE_INTERVAL) {
        lastIntervalTime = now;
        currentIntervalBytes = 0;
        
        // 立即发送累积的缓冲区数据
        if (buffer.length > 0) {
          this.push(Buffer.concat(buffer));
          buffer = [];
        }
      }
      
      // 如果当前间隔内已发送的数据超过限制，将数据放入缓冲区
      if (currentIntervalBytes + chunk.length > bytesPerInterval) {
        const bytesLeft = bytesPerInterval - currentIntervalBytes;
        
        if (bytesLeft > 0) {
          this.push(chunk.slice(0, bytesLeft));
          currentIntervalBytes += bytesLeft;
        }
        
        buffer.push(chunk.slice(bytesLeft));
        
        // 安排在下一个时间间隔发送剩余数据
        setTimeout(() => {
          this.push(Buffer.concat(buffer));
          buffer = [];
          callback();
        }, THROTTLE_INTERVAL - (now - lastIntervalTime));
      } else {
        // 数据量未超过限制，直接发送
        this.push(chunk);
        currentIntervalBytes += chunk.length;
        callback();
      }
    }
  });
}


app.post('/api/service/cloudDrive/io/upload', async (req, res) => {
  try {
    const dirPath = req.LOCAL.path;
    const filePath = dirPath + decodeURIComponent(req.files?.file[0].originalname);

    await fs.promises.rm(path.join(`/api/data/userCloud/${req.LOCAL.userInfo.resid}.cache`), { force: true, recursive: true });
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const { chunkNumber, totalChunks, fileHash } = req.body;
    const chunk = req.files?.file[0];

    if (!chunk) {
      return res.status(400).json({ code: 'NO_FILE', message: '未接收到文件' });
    }

    // 分块上传处理
    if (totalChunks > 1) {
      const chunkDir = path.join(
        root,
        `/api/data/userCloud/${req.LOCAL.userInfo.resid}.cache`,
        filePath.replace(root + 'api/data/userCloud/' + req.LOCAL.userInfo.resid + '/', '/')
      );

      await fs.promises.mkdir(chunkDir, { recursive: true });

      const chunkPath = path.join(chunkDir, chunkNumber);
      // 直接将内存中的Buffer写入文件
      await fs.promises.writeFile(chunkPath, chunk.buffer);

      if (parseInt(chunkNumber) === parseInt(totalChunks) - 1) {
        await mergeChunks(chunkDir, filePath, totalChunks);
        await fs.promises.rm(chunkDir, { recursive: true });
      }

      return res.json({
        code: 'SUCCESS',
        message: '分块上传成功',
        chunkNumber,
        totalChunks
      });
    }

    // 普通上传处理
    await fs.promises.writeFile(filePath, chunk.buffer);
    return res.json({ code: 'SUCCESS', message: '上传成功' });

  } catch (err) {
    console.error('上传失败:', err);
    res.status(500).json({
      code: 'UPLOAD_FAILED',
      message: err.message || '上传失败'
    });
  }
});

// 合并分块的函数（修改版）
async function mergeChunks(chunkDir, filePath, totalChunks) {
  const writeStream = fs.createWriteStream(filePath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, i.toString());
    const chunkBuffer = await fs.promises.readFile(chunkPath);
    writeStream.write(chunkBuffer);
  }

  writeStream.end();
  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

// 处理上传失败的中间件
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ code: 'UPLOAD_FAILED', message: '上传失败' });
  }
  next(err);
});

app.post('/api/service/cloudDrive/io/rm', async (req, res) => {
  const filePath = req.LOCAL.path;
  let files = req.query.files;
  if (!files) return res.status(400).json({ code: 'BAD_REQUEST', message: '缺少参数' });
  files = JSON.parse(files);
  try {
    let promises = [];
    for (const file of files) {
      // 修正路径构造
      const rmfilePath = path.join(filePath, file);
      console.log(rmfilePath);
      promises.push(fs.promises.rm(rmfilePath, { recursive: true }));
    }
    await Promise.all(promises);
    res.status(200).json({ code: 'SUCCESS', message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 'DELETE_FAILED', message: '删除失败' });
    console.error(err);
  }
});
app.post('/api/service/cloudDrive/io/mkdir', async (req, res) => {
  const filePath = req.LOCAL.path;
  const dirName = req.query.name;
  try {
    await fs.promises.mkdir(path.join(filePath, dirName), { recursive: true });
    res.status(200).json({ code: 'SUCCESS', message: '创建成功' });
  } catch (err) {
    res.status(500).json({ code: 'CREATE_FAILED', message: '创建失败' });
    console.error(err);
  }
});
app.post('/api/service/cloudDrive/io/mv', async (req, res) => {
  const filePath = req.LOCAL.path;
  const files = req.query.files;
  const toPath = req.query.toPath;
  if (!files ||!toPath) return res.status(400).json({ code: 'BAD_REQUEST', message: '缺少参数' });
  files = JSON.parse(files);
  try {
    let promises = [];
    for (const file of files) {
      // 修正路径构造
      const mvfilePath = path.join(filePath, file);
      const tofilePath = path.join(filePath, toPath, file);
      console.log(mvfilePath, tofilePath);
      promises.push(fs.promises.rename(mvfilePath, tofilePath));
    }
    await Promise.all(promises);
    res.status(200).json({ code: 'SUCCESS', message: '移动成功' });
  } catch (err) {
    res.status(500).json({ code: 'MOVE_FAILED', message: '移动失败' });
    console.error(err);
  }
});
app.post('/api/service/cloudDrive/io/cp', async (req, res) => {
  const filePath = req.LOCAL.path;
  const files = req.query.files;
  const toPath = req.query.toPath;
  if (!files ||!toPath) return res.status(400).json({ code: 'BAD_REQUEST', message: '缺少参数' });
  files = JSON.parse(files);
  try {
    let promises = [];
    for (const file of files) {
      // 修正路径构造
      const cpfilePath = path.join(filePath, file);
      const tofilePath = path.join(filePath, toPath, file);
      console.log(cpfilePath, tofilePath);
      promises.push(fs.promises.copyFile(cpfilePath, tofilePath));
    }
    await Promise.all(promises);
    res.status(200).json({ code: 'SUCCESS', message: '复制成功' });
  } catch (err) {
    res.status(500).json({ code: 'COPY_FAILED', message: '复制失败' });
    console.error(err);
  }
});


// 在所有路由之后添加错误处理中间件
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
}).listen(80, () => {
  console.log('Redirecting HTTP to HTTPS');
});
https.createServer(options, app).listen(443, () => {
  console.log(`Server is running.`);
});
