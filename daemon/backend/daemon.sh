#!/bin/bash

# 定义停止时执行的函数
cleanup() {
  echo "Stopping DPBox daemon..."
  ./close-database.sh
  exit 0
}

# 注册信号处理函数（捕获 SIGTERM 和 SIGINT）
trap cleanup SIGTERM SIGINT

./init-database.sh &
node index.js