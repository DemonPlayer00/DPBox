#概述  
DPBox是一个**尚未完成**的网站框架，起初是以**家庭文件管理器**为目的设计，现在计划加入更多功能。  
  
#部署  
DPBox以简单为原则进行部署。以下是准备步骤：  
```
git clone https://github.com DemonPlayer00/DPBox.git
cd DPBox
chmod +x daemon/backend/*.sh
#(install nodejs)
cd /daemon/backend
npm init -y
./packinstall.sh
#(start redis)
node index.js
```
