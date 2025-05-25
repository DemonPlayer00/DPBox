export PREFIX=/data/data/com.termux/files/usr
export HOME=/data/data/com.termux/files/home
export LD_LIBRARY_PATH=$PREFIX/lib
export PATH=$PREFIX/bin:$PATH
cd ~/DPBox.org/daemon/backend

#trap 'redis-cli shutdown && echo "redis shutdown"' EXIT

$PREFIX/bin/bash -c "redis-server" &
$PREFIX/bin/bash -c "sudo node index.js --root ~/DPBox.org/"
