function getBaseDialog(title, message, cancelText = "Cancel", oncloseClear = true) {
    var overlay = document.createElement("div");
    overlay.setAttribute("class", "dialog-overlay");
    var dialog = document.createElement("div");
    dialog.setAttribute("class", "dialog");
    overlay.appendChild(dialog);

    var dialogHeader = document.createElement("div");
    dialogHeader.setAttribute("class", "dialog-header");
    var dialogTitle = document.createElement("h2");
    dialogTitle.innerHTML = title;
    dialogHeader.appendChild(dialogTitle);
    dialog.appendChild(dialogHeader);

    var dialogContent = document.createElement("div");
    dialogContent.setAttribute("class", "dialog-content");
    dialogContent.innerHTML = message;
    dialog.appendChild(dialogContent);

    var dialogButtons = document.createElement("div");
    dialogButtons.setAttribute("class", "dialog-buttons");
    var dialogButton = document.createElement("div");
    dialogButton.setAttribute("class", "dialog-button-cancel");
    dialogButton.innerHTML = cancelText;

    // 初始状态：隐藏
    overlay.style.display = "none";

    dialog.show = function() {
        if (overlay.closing) return; // 防止在关闭动画中调用
        document.body.appendChild(overlay); // 确保 overlay 在 DOM 中
        overlay.style.display = "flex";    // 使用 flex/block 显示
        setTimeout(() => {
            dialog.style.scale = "1";      // 重置缩放
            overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; // 重置背景
            overlay.style.pointerEvents = "auto";     // 启用交互
        }, 10); // 微延迟确保样式生效
    };

    dialog.close = function() {
        if (overlay.closing) return;
        overlay.closing = true;
        dialog.style.scale = "0";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0)";
        overlay.style.pointerEvents = "none";

        const cleanup = () => {
            if (oncloseClear) {
                overlay.parentNode?.removeChild(overlay);
            } else {
                overlay.style.display = "none";
                overlay.closing = false; // 重置状态
            }
        };

        dialog.addEventListener("transitionend", cleanup, {once: true});
    };

    overlay.addEventListener("click", function(event) {
        if (event.target === overlay) {
            dialog.close();
        }
    });

    dialogButton.addEventListener("click", function() {
        dialog.close();
    });

    dialogButtons.appendChild(dialogButton);
    dialog.appendChild(dialogButtons);
    return dialog;
}

function getConfirmDialog(title, message, callback){
    var dialog = getBaseDialog(title, message);
    var dialogButton = document.createElement("div");
    dialogButton.setAttribute("class", "dialog-button-confirm");
    dialogButton.innerHTML = "Confirm";
    dialogButton.addEventListener("click", function(){
        callback();
        dialog.close();
    });
    dialog.querySelector(".dialog-buttons").appendChild(dialogButton);
    return dialog;
}

function getCustomCaseDialog(title, message, cases, callback){
    var dialog = getBaseDialog(title, message);
    for(var i = 0; i < cases.length; i++){
        var caseButton = document.createElement("div");
        caseButton.setAttribute("class", "dialog-button");
        caseButton.innerText = cases[i];
        caseButton.addEventListener("click", function(event){
            callback(event.target.innerText);
            dialog.close();
        });
        dialog.querySelector(".dialog-buttons").appendChild(caseButton);
    }
    return dialog;
}

function getFileInputDialog(title, callback, multiple = true, oncloseClear = true){
    var dialog = getBaseDialog(title, '', "Close", oncloseClear);
    var fileInput = document.createElement("input");
    fileInput.setAttribute("type", "file");
    fileInput.setAttribute('multiple', multiple);
    var uploadToInput = document.createElement("input");
    uploadToInput.setAttribute("type", "text");
    uploadToInput.setAttribute("placeholder", "（当前目录）");
    uploadToInput.style.marginTop = "10px";
    uploadToInput.style.width = "100%";
    uploadToInput.style.padding = "5px";
    uploadToInput.style.border = "1px solid #ccc";
    var progress = document.createElement("progress");
    progress.setAttribute("class", "file-progress");
    progress.value = 0;
    progress.max = 100;
    var subprogress = document.createElement("progress");
    subprogress.setAttribute("class", "file-progress");
    subprogress.value = 0;
    subprogress.max = 100;

    var ConfirmButton = document.createElement("div");
    ConfirmButton.setAttribute("class", "dialog-button-confirm");
    ConfirmButton.innerHTML = "Confirm";
    ConfirmButton.addEventListener("click", async ()=>{
        ConfirmButton.style.pointerEvents = "none";
        ConfirmButton.style.backgroundColor = "#3338";
        fileInput.disabled = true;
        await callback(fileInput.files, uploadToInput.value, progress, subprogress);
        ConfirmButton.style.pointerEvents = "auto";
        ConfirmButton.style.backgroundColor = "#333";
        fileInput.disabled = false;
    });
    dialog.querySelector(".dialog-buttons").appendChild(ConfirmButton);
    dialog.querySelector(".dialog-content").appendChild(fileInput);
    dialog.querySelector(".dialog-content").appendChild(uploadToInput);
    dialog.querySelector(".dialog-content").appendChild(progress);
    dialog.querySelector(".dialog-content").appendChild(subprogress);
    return dialog;
}

export default {
    getBaseDialog,
    getConfirmDialog,
    getCustomCaseDialog,
    getFileInputDialog
};