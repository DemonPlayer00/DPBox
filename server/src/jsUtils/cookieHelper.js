function setCookie(name, value, ms, path='/') {
    if (ms) {
        const date = new Date();
        date.setTime(date.getTime() + ms);
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toGMTString()};path=${path};SameSite=None;Secure`;
    } else {
        document.cookie = `${name}=${encodeURIComponent(value)};path=/;SameSite=None;Secure`;
    }
}

function getCookie(name) {
    // 构建一个正则表达式来匹配特定的 Cookie 名称
    const matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()[\]\/+^])/g, '\\$1') + "=([^;]*)"
    ));
    try {
        return matches ? decodeURIComponent(matches[1]) : undefined;
    } catch (e) {
        console.error("Failed to decode cookie value:", e);
        return undefined;
    }
}

export default {
    setCookie,
    getCookie
}