export PREFIX=/data/data/com.termux/files/usr
export HOME=/data/data/com.termux/files/home
export LD_LIBRARY_PATH=$PREFIX/lib
export PATH=$PREFIX/bin:$PATH
cd ~/DPBox.org/daemon/backend

# 定义停止时执行的函数
cleanup() {
  echo "Stopping DPBox daemon..."
  ./close-database.sh
  exit 0
}

# 注册信号处理函数（捕获 SIGTERM 和 SIGINT）
trap cleanup SIGTERM SIGINT

$PREFIX/bin/bash -c "sudo node index.js"
