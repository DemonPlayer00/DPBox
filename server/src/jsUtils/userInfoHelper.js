async function getUserInfo() {
    let userInfo = null;
    await fetch('/api/user/getUserInfo', {
        redirect: 'manual',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
       .then(response => {
            return response.json();
       })
       .then(data => {
            //console.log(data);
            if (data.code === 'SUCCESS') {
                userInfo = data.userInfo;
            }else{
                window.location.href = `/login.html?code=${data.code}`;
            }
        })
       .catch(error => console.log(error));
        return userInfo;
}

async function getUserServices(){
    let userServices = null;
    await fetch('/api/user/getServices', {
        redirect: 'manual',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
       .then(response => {
            return response.json();
       })
       .then(data => {
            //console.log(data);
            if (data.code === 'SUCCESS') {
                userServices = data.services;
            }else{
                window.location.href = `/login.html?code=${data.code}`;
            }
        })
       .catch(error => console.log(error));
        return userServices;
}

export default {
    getUserInfo,
    getUserServices
};