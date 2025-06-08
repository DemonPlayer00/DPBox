const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

let fifoPath = '';
let fd = null;
let isReading = false;
const emitter = new EventEmitter();
const bufferSize = 1024;

function init(root) {
    fifoPath = path.join(root, 'daemon', 'backend', 'fifo');
    
    try {
        if (!fs.existsSync(fifoPath)) {
            console.error("Fifo is not exist.");
            process.exit(1);
        }
        
        openFifo();
        
    } catch (err) {
        console.error('Fifo initialization failed:', err);
        process.exit(1);
    }
}

function openFifo() {
    // 使用O_NONBLOCK模式打开FIFO
    fs.open(fifoPath, 'r', (err, fileDescriptor) => {
        if (err) {
            console.error('Error opening FIFO:', err);
            setTimeout(openFifo, 1000);
            return;
        }
        
        fd = fileDescriptor;
        console.log('FIFO opened for reading');
        startReading();
    });
}

function startReading() {
    if (isReading || !fd) return;
    isReading = true;
    
    const buffer = Buffer.alloc(bufferSize);
    
    function readChunk() {
        if (!fd) return;
        
        fs.read(fd, buffer, 0, bufferSize, null, (err, bytesRead) => {
            if (err) {
                if (err.code === 'EAGAIN' || err.code === 'EWOULDBLOCK') {
                    // 没有数据可读，稍后重试
                    setTimeout(readChunk, 1000);
                    return;
                }
                
                console.error('Read error:', err);
                closeFifo();
                setTimeout(openFifo, 1000);
                return;
            }
            
            if (bytesRead > 0) {
                const command = buffer.toString('utf8', 0, bytesRead).trim();
                console.log('Received command:', command);
                emitter.emit('command', command);
            }
            
            // 继续读取下一个块
            setImmediate(readChunk);
        });
    }
    
    readChunk();
}

function closeFifo() {
    if (fd) {
        fs.close(fd, (err) => {
            if (err) console.error('Error closing FIFO:', err);
            fd = null;
            isReading = false;
        });
    }
}

function on(command, callback) {
    emitter.on('command', (receivedCommand) => {
        if (receivedCommand === command) {
            callback();
        }
    });
}

module.exports = {
    init,
    on
};
