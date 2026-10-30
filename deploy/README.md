# 部署：把 static 站点放到 ECS 120.26.245.237（备案期先走 IP:8080）

> 现状：域名 `chaiguan555.top` 备案审批中，国内 ECS 此时不能用 80/443 绑域名，先用 **IP + 8080** 预览。
> 本目录的东西都不需要我登录你的服务器：你在本地跑 `pack.sh`，再用 scp 上传，服务器上执行两条命令即可。

## 0. 前置（服务器上一次性）
```bash
# 以 Alibaba Cloud Linux / CentOS 为例；Ubuntu 用 apt 同理
sudo dnf install -y nginx || sudo yum install -y nginx
sudo systemctl enable --now nginx
sudo mkdir -p /var/www/chaiguan
```
**阿里云控制台 → 该 ECS 的安全组 → 入方向放行 TCP 8080**（80/443 等备案下来再放行）。

## 1. 本地构建打包
```bash
cd "/d/tool/workspace/个人博客创作"
bash deploy/pack.sh
```
产物：`deploy/chaiguan-site.tar.gz`（约几 MB，只有 `public/` 里的静态文件）。

## 2. 上传
```bash
scp deploy/chaiguan-site.tar.gz root@120.26.245.237:/tmp/
```
（用非 root 用户就换用户名；密钥已配好时无需密码。）

## 3. 解压 + 挂 nginx
```bash
ssh root@120.26.245.237
sudo rm -rf /var/www/chaiguan/* 
sudo tar xzf /tmp/chaiguan-site.tar.gz -C /var/www/chaiguan
sudo chown -R nginx:nginx /var/www/chaiguan     # Ubuntu 上用户是 www-data
# 上传 deploy/nginx-chaiguan.conf 到 /etc/nginx/conf.d/chaiguan.conf 后：
sudo nginx -t && sudo systemctl reload nginx
```

## 4. 验收（在你自己电脑上）
```bash
curl -I http://120.26.245.237:8080/          # 期望 200，Content-Type: text/html
curl -s http://120.26.245.237:8080/ | head -5
```
浏览器打开 `http://120.26.245.237:8080/`，逐项点：首页打字机、滚动后导航变实色、文章页目录、暗色切换、搜索。

## 5. 备案下来之后（改三处即可）
1. `deploy/nginx-chaiguan.conf`：`server_name` 改成 `chaiguan555.top www.chaiguan555.top`，加一个 `listen 80` 的 server 直接 301 到 https。
2. `site/_config.yml` 的 `url` 改成 `https://chaiguan555.top`，重新 `pack.sh`。
3. 证书：`sudo dnf install -y certbot python3-certbot-nginx && sudo certbot --nginx -d chaiguan555.top -d www.chaiguan555.top`。

## 注意
- 只上传 `public/`，**不要**把 `node_modules`、`site/` 源码传上服务器（静态站不需要 Node 运行时）。
- 每次改文章后重复「1 → 2 → 3 的解压那一段」即可，nginx 不用动。
- 别把 8080 当长期方案：备案通过后按第 5 步切到 443。
