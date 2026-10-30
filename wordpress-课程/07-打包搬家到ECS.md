# 07 · 打包搬家：把本地 WordPress 搬到阿里云 ECS

> 一句话答案：**可以，而且是标准做法。** 但"打包"必须是**两样东西一起走**——文件和数据库。
> 只压 `wp-content` 或整个站点文件夹上传，结果一定是：站打开了、文章全没了、图片全裂了。

## 一、为什么必须打包"文件 + 数据库"

| 东西 | 里面有什么 | 存在哪 |
|---|---|---|
| **文件** | 主题、插件、你上传的图片 | `wp-content/`（约 90% 的体积） |
| **数据库** | 文章正文、标题、分类、菜单、评论、**站点地址**、**主题的所有设置**、插件的配置 | MySQL 的 `wp_` 开头那十几张表（通常几十 MB） |

`wp_posts` 表里存的才是文章正文——你 `wp-content` 里根本没有文章。
`wp_options` 里存着 `siteurl`、`home` 和 Argon 主题那一堆选项——**所以搬过去之后外观设置也在**，前提是数据库也搬了。

## 二、搬家前必须想清楚的一件事：URL 会变

```
本地：  http://myblog.local
线上：  https://blog.你的域名.com
```

WordPress 把**绝对地址**写进了数据库的很多地方：

| 位置 | 例子 |
|---|---|
| `wp_options` 的 `siteurl` / `home` | `http://myblog.local` |
| 文章正文里的图片 | `<img src="http://myblog.local/wp-content/uploads/2026/03/a.jpg">` |
| 主题选项里上传的封面 | `http://myblog.local/wp-content/uploads/banner.webp` |
| 菜单里指向页面的链接 | `http://myblog.local/about/` |

**结论**：搬家 = 搬文件 + 导数据库 + **把数据库里所有 `myblog.local` 换成新域名**。
这一步做错，症状是：打开站点自动跳回本地地址、图片整片裂、后台点不动。

## 三、先把目标环境准备好（阿里云 ECS 版）

```
1. 买 ECS
   ├─ 地域：中国大陆（如杭州/北京）→ 域名必须 ICP 备案后才能用域名访问（7–20 工作日）
   │        中国香港/新加坡 → 免备案，立即可用，国内访问稍慢
   ├─ 规格：1核2G 起（跑 WP + 缓存够用；1核1G 会吃紧）
   └─ 镜像：Ubuntu 22.04 LTS 或 Debian 12（干净系统），不要选"带面板"的旧镜像
2. 安全组（这一步不做，域名永远打不开）
   入方向放行：22(SSH，建议只对自己 IP) / 80(HTTP) / 443(HTTPS)
3. 连上去：Windows 自带 ssh，或阿里云控制台"远程连接"
       ssh root@你的公网IP
4. 装宝塔面板（官网有安装命令，一行），得到 http://IP:8888 面板地址 + 账号密码
5. 面板 → 软件商店 → 一键装 LNMP：Nginx + MySQL 8.0 + PHP 8.1
6. 域名解析：域名商后台加 A 记录，@ 和 www 都指向 ECS 公网 IP
7. 面板 → 网站 → 添加站点：填域名 → 同时创建数据库（记住库名/用户/密码/字符集选 utf8mb4）
8. 面板 → 网站 → 站点设置 → 伪静态 → 选 "wordpress"（不做这步，文章详情页全 404）
```

> **轻量应用服务器 vs ECS**：前者有"WordPress 应用镜像"，开机就是装好的 WP，五分钟能上线，
> 适合纯写博客；ECS 是裸机，什么都要自己装，但学习价值高、可扩展。你想学真东西 → ECS。

## 四、三条搬家路线（按省事程度排序）

### 路线 A：插件一键搬（最省事）

```
本地：插件 → 安装 "All-in-One WP Migration"（或 Duplicator）
     → 导出 → 下载得到的 .wpress 文件
线上：装同一个插件 → 导入 → 上传 .wpress → 它会自动替换域名
```

- 优点：**自动处理 URL 替换**，零命令行。
- 限制：免费版单文件有上限（约 512MB），大站需要付费版或改用路线 B。
- 同类工具：`Duplicator`（导出一个 installer.php + 压缩包，适合跨主机）。

### 路线 B：面板手动搬（**推荐你学这条**，理解最透）

**第 1 步 · 本地打包**（Local 工具里点 `Go to site folder`，在 `app/public` 里操作）
```bash
cd "C:/Users/你/Local Sites/myblog/app/public"
tar -czf site-files.tar.gz wp-content
# 数据库：Local 里点 "Database" 打开 Adminer → 选你的库 → 导出 → 选 SQL → 执行 → 下载 .sql
```

**第 2 步 · 传到服务器**
面板 → 文件 → 进入站点根目录 → 上传 `site-files.tar.gz` 和 `db.sql` → 解压 `site-files.tar.gz`
（解压出来是 `wp-content` 目录，直接放在站点根目录即可）。

**第 3 步 · 装 WordPress 核心文件**
本地 `app/public` 里的 `wp-admin/`、`wp-includes/`、`index.php` 等也要一起传，
最省事的做法是：**服务器上先装一个干净的 WordPress**（面板一键部署或上传官方 zip），
再用你本地的 `wp-content` **覆盖**它的 `wp-content`。这样核心文件是干净的、可自动更新的。

**第 4 步 · 导入数据库**
面板 → 数据库 → phpMyAdmin → 选中你建的库 → 导入 → 选 `db.sql` → 执行。

**第 5 步 · 改 `wp-config.php`**
```php
define( 'DB_NAME', '你的库名' );
define( 'DB_USER', '你的用户' );
define( 'DB_PASSWORD', '你的密码' );
define( 'DB_HOST', 'localhost' );
```

**第 6 步 · 替换 URL**（关键，见下一节）

**第 7 步 · 收尾**
```
后台 → 设置 → 固定链接 → 什么都不改，直接点"保存更改"（刷新伪静态规则）
后台 → 外观 → 主题 → 确认 Argon 已启用
面板 → 站点设置 → SSL → Let's Encrypt 申请 → 开启强制 HTTPS
清掉所有缓存（插件缓存 / 浏览器 Ctrl+F5）
```

### 路线 C：命令行（熟了以后最快）

```bash
# 本地导出（在站点根目录）
mysqldump -u local -p'密码' local > db.sql
tar -czf site.tar.gz wp-content

# 传到服务器
scp site.tar.gz db.sql root@你的IP:/www/wwwroot/你的域名/

# 服务器上
cd /www/wwwroot/你的域名
tar -xzf site.tar.gz
mysql -u 用户 -p'密码' 库名 < db.sql

# 全局替换域名（WP-CLI 会自动处理序列化数据）
wp search-replace 'http://myblog.local' 'https://blog.你的域名.com' --all-tables --precise --report-changed-only
wp cache flush
```

## 五、URL 替换：本篇最容易翻车的一步

**为什么不能直接在 phpMyAdmin 里执行 SQL `REPLACE()`？**
因为 WordPress 很多配置是 **PHP 序列化**存的，字符串前面带长度，例如：

```
s:34:"http://myblog.local/wp-content/a.jpg";
```

你用 SQL 替换把 34 改成别的长度，但**长度前缀没跟着改**，PHP 反序列化就失败 →
表现：主题设置全部丢失、插件配置变空、部分页面白屏。

**正确做法（三种，任选一种）**：
| 方式 | 命令/操作 | 说明 |
|---|---|---|
| 插件 | `Better Search Replace` | 勾选所有表，勾"dry run"先试一次，再正式替换 |
| WP-CLI | `wp search-replace '旧URL' '新URL' --all-tables --precise` | 会正确处理序列化 |
| 迁移插件自带 | 路线 A 的导入过程 | 自动做，最省心 |

**替换顺序有讲究**：先换 `http://` → `https://`，再换域名，或者一条命令同时处理；
替换前**停用缓存插件**，替换后清缓存。

## 六、搬完必查 12 项

| # | 检查 | 怎么看 |
|---|---|---|
| 1 | 首页能开 | 浏览器打开 https://你的域名 |
| 2 | 后台能登 | /wp-admin |
| 3 | 站点地址正确 | 设置→常规，URL 已是新域名 |
| 4 | 文章正文在 | 随便打开一篇，正文完整 |
| 5 | 图片不裂 | 图片正常显示（F12 Network 无 404） |
| 6 | 封面/主题设置在 | 首屏 banner 图还在 |
| 7 | 固定链接能进 | 点开任意文章详情（不是 `?p=123` 形态） |
| 8 | 伪静态已配 | 面板站点设置 → 伪静态 = wordpress |
| 9 | HTTPS 生效 | 地址栏小锁；http 自动跳 https |
| 10 | 上传能用 | 后台传一张图，提示成功 |
| 11 | 时区/时间对 | 设置→常规→时区 Asia/Shanghai |
| 12 | 备份已配 | 装 UpdraftPlus，备份存到 OSS/本地之外 |

## 七、故障对照表

| 现象 | 原因 | 解决 |
|---|---|---|
| 打开跳回 `myblog.local` | 数据库 siteurl 没改 | 上面第五节替换 URL |
| 白屏 / critical error | PHP 报错被隐藏 | `wp-config.php` 开 `WP_DEBUG`，看 `wp-content/debug.log` |
| 图片全裂 | 正文里存的是旧域名 | 再跑一次 URL 替换（含 `postmeta`、`posts`） |
| 文章详情 404 | 伪静态没配 | 面板选 wordpress 伪静态规则 |
| 后台"重定向次数过多" | HTTPS 与反向代理冲突 | 面板检查是否强制 HTTPS + `wp-config` 里加 `$_SERVER['HTTPS']` 判断 |
| 上传大图失败 | PHP 上传限制 | 面板 PHP 设置里调 `upload_max_filesize`/`post_max_size` |
| 站点慢得像挂了 | 大陆未备案被拦 / 无缓存 | 先确认备案状态；装缓存插件，压缩图片 |
| 无法写入主题/插件 | 目录权限 | 面板把站点目录属主改成 `www`，权限 755/644 |

## 八、回滚方案（无条件先做这个）

```
1. 本地站点**先别删**，也不要在搬家期间升级主题/插件
2. 搬家前手动导出一份 db.sql + tar.gz，存本地
3. 线上装好后，先别换域名解析（用 hosts 或临时域名测试）
4. 测试通过再切解析；切了之后出问题，把解析切回去，线上环境不影响
```

## 验收

- [ ] 你能说出"搬家要搬哪两样东西"，以及为什么
- [ ] 你知道 URL 替换为什么不能用 SQL 直接 REPLACE
- [ ] 你选的路线是 A/B/C 中的哪条，为什么
- [ ] 你已经在本地演练过一次"导出 + 导入到新站点"
