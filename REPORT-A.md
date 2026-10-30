# REPORT-A · Hexo 8 + Fluid 站点骨架

阶段 A 交付：`site/` 下一个可本地预览的 Hexo 8.1.2 + hexo-theme-fluid 1.9.9 博客骨架，品牌占位值已配置，3 篇真实示例文章 + 4 个页面空壳，全部验收项通过。

---

## 1. 环境与版本

- OS: Windows（msys2 bash），Node v24.19.0，npm 11.17.0
- Hexo: 8.1.2，hexo-cli 4.3.2
- 主题: npm 包 `hexo-theme-fluid@1.9.9`（`_config.yml` 里 `theme: fluid`），没有 git clone、没有改 node_modules 里的主题源码
- 额外依赖：`nunjucks@^3`（Fluid 自带的本地搜索生成器 `scripts/generators/local-search.js` 直接 require 它；npm 没有自动装这个 peer 依赖，不装则 `hexo generate` 直接崩）

`npx hexo version` 完整输出（第一行 `INFO  Validating config` 是 Hexo 打到 stderr 的常规噪音，不是错误）：

```text
INFO  Validating config
hexo: 8.1.2
hexo-cli: 4.3.2
os: win32 10.0.26200 undefined
node: 24.19.0
acorn: 8.17.0
ada: 3.4.4
amaro: 1.1.10
ares: 1.34.6
brotli: 1.2.0
cldr: 48.0
icu: 78.3
llhttp: 9.4.3
merve: 1.2.2
modules: 137
napi: 10
nbytes: 0.1.4
ncrypto: 0.0.1
nghttp2: 1.69.0
nghttp3: 
ngtcp2: 
openssl: 3.5.7
simdjson: 4.6.4
simdutf: 6.4.0
sqlite: 3.53.3
tz: 2026b
undici: 7.29.0
unicode: 17.0
uv: 1.52.1
uvwasi: 0.0.23
v8: 13.6.233.17-node.51
zlib: 1.3.2.1-motley-3246f1b
zstd: 1.5.7
```

---

## 2. 目录树（`site/` 两层，排除 node_modules）

```text
site/
├── _config.yml                 # 站点配置（品牌占位值都在这里）
├── _config.fluid.yml           # 主题配置（Fluid 默认配置整份复制后按需改）
├── package.json / package-lock.json
├── db.json                     # Hexo 缓存（可删，会重建）
├── .gitignore
├── scaffolds/                  # draft.md / page.md / post.md
├── source/
│   ├── _posts/                 # 3 篇示例文章
│   ├── about/index.md          # /about/   空壳
│   ├── links/index.md          # /links/   空壳
│   ├── bangumi/index.md        # /bangumi/ 最小可用
│   ├── books/index.md          # /books/   最小可用
│   ├── css/custom.css          # 自定义样式钩子
│   └── img/                    # favicon.svg / loading.svg（本地占位小图标）
├── themes/.gitkeep             # 不用，主题从 node_modules 加载
└── public/                     # 生成物：404.html index.html archives/ about/ links/ bangumi/ books/ categories/ tags/ css/ js/ img/ xml/ local-search.xml
```

示例文章与页面：

```text
source/_posts/hexo8-fluid-skeleton.md   # 分类 技术（420 汉字）
source/_posts/anime-watching-log.md     # 分类 番剧（367 汉字）
source/_posts/reading-note-cards.md     # 分类 读书（441 汉字）
source/about/index.md  source/links/index.md  source/bangumi/index.md  source/books/index.md
```

---

## 3. 验收逐条自证

### 3.1 `npx hexo clean && npx hexo generate` → 退出码 0，无 error

```text
GENERATE_EXIT=0
grep -icE "error|warn|deprecat" → 0
INFO  49 files generated in 387 ms
```

`hexo generate` 输出最后 15 行：

```text
INFO  Generated: tags/建站/index.html
INFO  Generated: js/events.js
INFO  Generated: js/leancloud.js
INFO  Generated: js/openkounter.js
INFO  Generated: js/local-search.js
INFO  Generated: js/color-schema.js
INFO  Generated: js/utils.js
INFO  Generated: archives/2025/index.html
INFO  Generated: js/umami-view.js
INFO  Generated: js/plugins.js
INFO  Generated: img/default.png
INFO  Generated: img/random/default.png
INFO  Generated: tags/Hexo/index.html
INFO  Generated: css/main.css
INFO  49 files generated in 387 ms
```

（`img/default.png` 是主题自带的默认图，不是外链、不是下载的大图。）

### 3.2 `npx hexo server -p 4100` 后各 URL 实测状态码

在最终构建上实测（服务器已在本轮验收后关闭）：

```text
200  /
200  /archives/
200  /about/
200  /links/
200  /bangumi/
200  /books/
200  /archives/hexo8-fluid-skeleton/     # 文章页
200  /local-search.xml                   # 本地搜索索引（主题自带生成器产物）
200  /css/custom.css                     # 自定义样式钩子确实被挂上
```

关闭与端口释放：

```text
kill: cancellation-requested
无 LISTENING，4100 已释放
curl 停机后 → code=000（连接失败，符合预期）
无 node.exe 残留
```

### 3.3 首页 HTML 含站点名与打字机副标题（服务端返回体实测）

```text
<title>Chaiguan</title>
id="banner"
data-typed-text="记录技术与生活"
```

（首页 21378 字节，`Chaiguan` 出现 5 次：`<title>`、隐藏 `h1`、导航栏、meta 等。）

### 3.4 `public/` HTML 数量与文章页路径

```text
find public -name "*.html" | wc -l → 24      # > 6
public/archives/hexo8-fluid-skeleton/index.html   # 存在
public/archives/anime-watching-log/index.html     # 存在
public/archives/reading-note-cards/index.html     # 存在
public/archives/index.html                        # 归档索引
```

---

## 4. 需要你改的占位值（文件:行号 → 当前值）

品牌与站点信息（一处改全站生效）：

| 文件:行号 | 键 | 当前值 | 说明 |
| --- | --- | --- | --- |
| `site/_config.yml:6` | `title` | `Chaiguan` | 站点名：`<title>`、导航栏标题、首页隐藏 h1 |
| `site/_config.yml:7` | `subtitle` | `记录技术与生活` | 首页打字机副标题 |
| `site/_config.yml:8` | `description` | `记录技术、番剧与读书的个人博客` | SEO description |
| `site/_config.yml:10` | `author` | `chaiguan` | 文章署名 / 版权 |
| `site/_config.yml:11` | `language` | `zh-CN` | 界面语言 |
| `site/_config.yml:12` | `timezone` | `Asia/Shanghai` | 文章时间时区 |
| `site/_config.yml:16` | `url` | `http://120.26.245.237:8080` | 站点绝对地址，绑域名后改这一行 |
| `site/_config.yml:18` | `permalink` | `archives/:title/` | 文章地址 = `/archives/<文件名>/` |

主题侧与品牌相关的三处：

| 文件:行号 | 键 | 当前值 | 说明 |
| --- | --- | --- | --- |
| `site/_config.fluid.yml:368` | `navbar.blog_title` | `"Chaiguan"` | 导航栏左侧标题，与 `_config.yml` 的 `title` 分开维护 |
| `site/_config.fluid.yml:528` | `index.slogan.text` | `""` | 故意留空 → 回落到 `_config.yml` 的 `subtitle`，只改一处即可 |
| `site/_config.fluid.yml:387-395` | `navbar.menu` | 8 项导航 | 顺序：首页/归档/分类/标签/番剧/书单/友链/关于 |

另有 `site/_config.fluid.yml:21` `favicon`、`:25` `apple_touch_icon` 指向本地占位 `/img/favicon.svg`，阶段 B 换成正式图标即可。

---

## 5. 主题能力开关（都在 `site/_config.fluid.yml`，本阶段已显式打开）

| 能力 | 位置 | 值 |
| --- | --- | --- |
| 深色模式（跟随系统 + 手动切换按钮） | `:130` `dark_mode` / `:131` `enable` / `:135` `default` | `true` / `auto` |
| 本地搜索 | `:399` `search` / `:400` `enable`（`:404` 索引路径 `/local-search.xml`） | `true` |
| 代码高亮 | `:50` `code.highlight` / `:51` `enable` / `:60` `lib: "highlightjs"` | `true` |
| 代码复制按钮 | `:40` `code.copy_btn` | `true` |
| 图片懒加载 | `:338` `lazyload` / `:339` `enable` | `true` |
| 图片点击放大 | `:732` `post.image_zoom` / `:733` `enable` | `true` |
| 文章目录（右侧） | `:675` `post.toc` / `:676` `enable` / `:684` `placement: right` | `true` / `right` |
| 字数统计 | `:608` `post.meta.wordcount` / `:609` `enable` | `true`（实测文章页渲染 748 字） |
| 阅读时长 | `:613` `post.meta.min2read` / `:614` `enable` | `true` |
| 顶部进度条 | `:121` `fun_features.progressbar` / `:122` `enable` | `true` |
| 打字机副标题 | `:85` `fun_features.typing` / `:86` `enable` | `true` |
| banner 留空 | `:509`/`:581`/`:953`/`:964`/`:993`/`:1010`/`:1032`/`:1043`/`:1057` `banner_img` | `""`（全部页面） |

自定义钩子：`site/_config.fluid.yml:242` `custom_css: - /css/custom.css`；`custom_js` 留空（约定放 `source/js/xxx.js` 后写 `/js/xxx.js`）。

---

## 6. 偏离 brief 的决定与原因

1. **`permalink` 定为 `archives/:title/`**（不是 `:year/:month/:day/:title/`）。
   原因：验收项 3.4 要求 `public/archives/<某篇>/index.html` 存在；把 slug 放在 `archives/` 前缀下同时满足"清晰 slug"（`/archives/hexo8-fluid-skeleton/`，无日期、无中文）和该验收项。归档索引页 `/archives/` 与文章页 `/archives/<slug>/` 并存，无路径冲突（generate 无冲突告警，实测两条 URL 都是 200）。

2. **`source/css/custom.css` 不是严格空文件**（4 行有效内容）。
   原因：banner_img 按要求留空后，主题的 banner 内联样式会变成 `background: url('/') ...`，首屏退化为白底 + 白字副标题，属于 brief 明令禁止的"白屏"。因此按 brief §6 允许的"纯色兜底"写了 `#banner { background-color: #2f4154 !important; background-image: none !important; }`（后者顺手挡掉空路径产生的无效图片请求）。阶段 B 做暖调纸感渐变时整块替换。

3. **`/about/`、`/links/` 用普通页面空壳，没用 Fluid 原生的 about/links 版式**。
   原因：Fluid 的 `layout: about` / `layout: links` 依赖 avatar、友链 items 与 banner 图，而本阶段既无素材也要求"空壳"。所以两页是 `layout: page` + 一句占位；`_config.fluid.yml` 里 `about:` / `links:` 两段保持默认（当前不生效），阶段 C 做版式时可直接切过去。

4. **番剧、书单两个导航项没有 icon**。
   原因：Fluid 的 iconfont 是外链 CDN（`//at.alicdn.com/...`），无法在本地确认 `icon-video-fill` 之类的 class 一定存在；宁可不给图标，也不留一个空方块。两项目前带 `name: "番剧"` / `name: "书单"` 强制显示中文名。其余 6 项沿用主题默认图标。

5. **额外安装 `nunjucks`**。
   原因：Fluid 的 `scripts/generators/local-search.js` 里 `require('nunjucks')`，而 npm 没有自动安装这个 peerDependencies；不装则 `hexo generate` 在搜索索引环节直接报错。

6. **代码块仍由服务端预渲染**：即便 `_config.yml:48` 设了 `syntax_highlighter: ''`，实测代码块输出的是 `<figure class="highlight bash"><td class="gutter">…</td><td class="code"><pre><code class="hljs bash">`。
   处理：Fluid 前端的 `codeWidget`（`source/js/plugins.js`）正好兼容这种结构——它会跳过含 `span.line` 的行号 `pre`，从 `td.code > pre > code` 的 classList 取语言并挂复制按钮，所以保持现状、不做二次改造。若阶段 B 想要前端 highlight.js 渲染的 `<pre><code class="language-bash">` 结构，需要先排查这个预渲染来源。

7. **清理了生成骨架自带的噪音**：删掉 `_config.landscape.yml`、`.github/`、`source/_posts/hello-world.md`，并在 `package.json` 里卸掉 `hexo-theme-landscape`。

8. **新增两个本地占位小图标** `source/img/favicon.svg`、`source/img/loading.svg`。
   原因：主题默认会引用 `/img/favicon`、`/img/loading.gif`，本阶段没有素材，若保持默认会在前端产生 404。两者都是手写的几百字节 SVG，非外链、非下载图片；阶段 B 换正式素材即可。

---

## 7. 常用命令

```bash
cd "/d/tool/workspace/个人博客创作/site"

npx hexo clean && npx hexo generate   # 生成静态文件到 public/
npx hexo server -p 4100               # 本地预览 http://127.0.0.1:4100
npx hexo new post "文章标题"           # 新文章，文件名决定 /archives/<文件名>/
```

---

## 8. 留给阶段 B / C 的口子

- `site/source/css/custom.css`：唯一的样式覆盖入口（已挂到 `custom_css`），阶段 B 在这里做设计 token、配色、暖调纸感渐变，替换现在的 banner 兜底。
- `_config.fluid.yml` 的 `color:`(`:140` 起) 与 `font:`(`:228` 起)：改配色/字体优先用这里的变量，能不写 CSS 就不写。
- `about:` / `links:` 配置段 + `source/about`、`source/links` 两个空壳页：阶段 C 做版式时切换布局与填内容。
- `source/bangumi`、`source/books`：目前只有"建设中"占位，阶段 C 填番剧表与书单结构。
