init_database(){
  echo "Initializing DPBox database..."
  redis-server --port 1145 --dir ./ --dbfilename data.rdb &
  sleep 1
}

close_database(){
  echo "Closing DPBox database..."
  redis-cli -p 1145 shutdown || echo "Failed to shutdown redis server"
}

# 注册信号处理函数（捕获 SIGTERM 和 SIGINT）
trap close_database SIGTERM SIGINT

init_database
node index.js
