import dialogHelper from './dialogHelper.js';

async function ls(path) {
    let files = null;
    await fetch('/api/service/cloudDrive/io/ls?path=' + encodeURIComponent(path)).then(response => response.json()).then(data => {
        //console.log(data);
        files = data.files;
    });
    return files;
}
async function stat(path) {
    let stat = null;
    await fetch('/api/service/cloudDrive/io/stat?path=' + encodeURIComponent(path)).then(response => response.json()).then(data => {
        //console.log(data);
        stat = data.stat;
    });
    return stat;
}

function getFileContent(file){
    const fileContent = document.createElement('div');
    fileContent.classList.add('fileContent');
    const fileImg = document.createElement('img');
    fileImg.classList.add('fileImg');
    fileImg.src = file.type === 'dir' ? '/src/icon/dir.svg' : '/src/icon/file.svg';
    const fileName = document.createElement('span');
    fileName.classList.add('fileName');
    fileName.innerText = file.name;
    const fileTime = document.createElement('span');
    fileTime.classList.add('fileTime');
    fileTime.innerText = new Date(file.mtime).toLocaleString();
    fileContent.appendChild(fileImg);
    fileContent.appendChild(fileName);
    fileContent.appendChild(fileTime);
    return fileContent;
}

function downloadFile(path, fileName) {
    const a = document.createElement('a');
    a.href = `/api/service/cloudDrive/io/download?path=${encodeURIComponent(path + '/' + fileName)}`;
    a.download = encodeURIComponent(fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
async function downloadFiles(path, files, i = 0) {
    if (i >= files.length) return;

    dialogHelper.getCustomCaseDialog(`(${i + 1}/${files.length}) 手动下载确认`, `是否要下载 ${files[i]} ？`, ['Confirm', 'Next'], (caseArg) => {
        if (caseArg === 'Confirm') {
            downloadFile(path, files[i]);
        }
        downloadFiles(path, files, i + 1);
    }).show();
}

async function uploadFile(path, file, progress=null, subprogress=null, filesLength=1, filesIndex=0) {
    if (!file) {
        alert('请选择一个文件上传');
        return;
    }

    const chunkSize = 1024 * 1024; // 每个分块的大小为1MB
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end, file.type);
        await uploadChunk(chunk, i, totalChunks);
        if (progress) {
            progress.value = ((filesIndex * totalChunks + i + 1) / (filesLength * totalChunks)) * 100;
        }
        if (subprogress) {
            subprogress.value = ((i + 1) / totalChunks) * 100;
        }
    }
    
    async function uploadChunk(chunk, chunkNumber, totalChunks) {
        const formData = new FormData();
        console.log(file.name);
        formData.append('file', chunk, encodeURIComponent(file.name)); // 注意这里使用 file.name 而不是 chunk.name
        formData.append('chunkNumber', chunkNumber);
        formData.append('totalChunks', totalChunks);

        // 构建查询参数
        //const queryParams = new URLSearchParams();
        //queryParams.append('path', path + file.name);

        try {
            const response = await fetch(`/api/service/cloudDrive/io/upload?path=${encodeURIComponent(path)}`, {
                method: 'POST',
                body: formData,
                // 注意：当使用 FormData 时，不要手动设置 Content-Type，
                // 浏览器会自动设置正确的 content-type 和 boundary
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '上传失败');
            }

            if (data.code === 'SUCCESS') {
                console.log(`分块 ${chunkNumber + 1}/${totalChunks} 上传成功`);
            } else {
                console.error('分块上传失败:', data.message);
            }
        } catch (error) {
            console.error('上传失败:', error);
        }
    }
}

async function uploadFiles(path, files, progress=null, subprogress=null) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadFile(path, file, progress, subprogress, files.length, i);
    }
    if (progress) {
        progress.value = 0;
    }
    if (subprogress) {
        subprogress.value = 0;
    }
}

async function rm(path, files) {
    let query = [];
    for (let i = 0; i < files.length; i++) {
        query.push(encodeURIComponent(files[i]));
    }
    console.log(JSON.stringify(query));
    await fetch('/api/service/cloudDrive/io/rm?path=' + encodeURIComponent(path) + '&files=' + JSON.stringify(query), {method: 'POST'}).then(response => response.json()).then(data => {
        console.log(data);
    });
}

async function mkdir(path, name) {
    await fetch('/api/service/cloudDrive/io/mkdir?path=' + encodeURIComponent(path) + '&name=' + encodeURIComponent(name), {method: 'POST'}).then(response => response.json()).then(data => {
        console.log(data);
    });
}

async function mv(path, name, newPath, newName) {
    await fetch('/api/service/cloudDrive/io/mv?path=' + encodeURIComponent(path) + '&name=' + encodeURIComponent(name) + '&newPath=' + encodeURIComponent(newPath) + '&newName=' + encodeURIComponent(newName), {method: 'POST'}).then(response => response.json()).then(data => {
        console.log(data);
    });
}

export default { ls, stat, getFileContent, downloadFile, downloadFiles, uploadFile, uploadFiles, rm, mkdir, mv};