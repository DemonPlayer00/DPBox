function sortByName(files, delta) {
    return files.sort((a, b) => {
        if (a.name < b.name) {
            return -1 * delta;
        } else if (a.name > b.name) {
            return 1 * delta;
        } else {
            return 0;
        }
    });
}
function sortBySize(files, delta) {
    return files.sort((a, b) => {
        if (a.size < b.size) {
            return -1 * delta;
        } else if (a.size > b.size) {
            return 1 * delta;
        } else {
            return 0;
        }
    });
}
function sortByTime(files, delta) {
    return files.sort((a, b) => {
        if (a.mtime < b.mtime) {
            return -1 * delta;
        } else if (a.mtime > b.mtime) {
            return 1 * delta;
        } else {
            return 0;
        }
    });
}
function classifFiles(fileList, delta = 1) {
    let files = [];
    let dirs = [];
    for (let i = 0; i < fileList.length; i++) {
            if (fileList[i].type == "dir") {
                dirs.push(fileList[i]);
            } else {
                files.push(fileList[i]);
            }
    }
    if (delta === 1) {
        return dirs.concat(files);
    }
    if(delta === -1) {
        return files.concat(dirs);
    }
}

export default {
    sortByName,
    sortBySize,
    sortByTime,
    classifFiles
};