#!/bin/bash

init_database(){
  echo "Initializing DPBox database..."
  redis-server --port 1145 --dir ./ --dbfilename data.rdb &
  sleep 1
}
close_database(){
  echo "Closing DPBox database..."
  redis-cli -p 1145 save
  redis-cli -p 1145 shutdown
}

# 定义停止时执行的函数
cleanup() {
  echo "Stopping DPBox daemon..."
  close_database
  exit 0
}

# 注册信号处理函数（捕获 SIGTERM 和 SIGINT）
trap cleanup SIGTERM SIGINT

init_database
node index.js