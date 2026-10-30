# 源站拆解 · blog.yurucamp.vip（夕凪の小站）

> 取证方式：抓取首页 HTML、主题 argon_style.css / argontheme.js、页面内联 argonConfig，
> 用 headless Chrome（CDP）渲染出 7 张截图（shots/ 目录）。
> 标注：〔实测〕= 原文/渲染结果；〔推断〕= 基于证据的判断。

## 0. 截图索引（shots/）

| 文件 | 内容 |
|---|---|
| `01-home-desktop.png` | 首页整页（浅色）1440×3201 |
| `02-home-dark.png` | 首页整页（夜间模式，FAB 点击后） |
| `04-home-mobile.png` | 移动端 390×844 @2x 整页 |
| `05a-post-top.png` | 文章页首屏（banner 用文章缩略图） |
| `05b-post-full.png` | 文章页整页 8407px |
| `06-home-fabs.png` | 滚动 1100px 后视口：封面转固定背景 + 顶栏变实色 + FAB 列 |
| `07-settings-popup.png` | 右下角"博客设置"面板打开态 |
| `03-post-desktop.png` | 404 空状态（顺带留下 shape 装饰圈的样子） |

## 1. 站点身份

| 项 | 值 |
|---|---|
| 站点 | 夕凪の小站 / 「普通人的爱好分享地」 |
| 作者 | refrain（大一学生，文理双修）；分类：图寻、建站、服务器、Art、Meanless |
| CMS | WordPress 7.1.4 + Cloudflare〔实测 generator meta〕 |
| 主题 | **Argon 1.3.5**（solstice23，基于 Argon Design System / Bootstrap 4 的 Material 系） |
| 规模 | 7 文章 / 7 分类 / 0 标签〔实测侧栏计数〕 |
| 永久链接 | 标题 slug 型：`/vmiss-us-la-tri-basic-nq测试自存/`〔实测 REST API〕 |
| html 根类 | `immersion-color banner-as-cover toolbar-blur article-header-style-1`〔实测〕 |

结论先说：**这不是原创手作设计，是一套成熟主题 + 站主自己的选图与文案**。
所以"能不能复刻"的答案是能——结构、动效、交互全都是可读源码的公开实现；
唯一的不可复制项是封面插画的审美与内容人格。

## 2. 设计系统：一套色相派生全部表面色

这是全站"统一感"的真正机制，也是复刻时必须原样搬走的一条〔实测 argon_style.css〕：

```css
--themecolor: #fa7298;   /* 唯一强调色，樱粉 */
--themecolor-R/G/B: 250/114/152;

/* 表面色 = 主题色与白的混合，N 为不透明度百分比 */
--color-tint-86: calc(var(--themecolor-R) + (255 - var(--themecolor-R)) * 0.86), ...;
```

| 用途 | 变量 | 实际值 |
|---|---|---|
| 页面底色 | `--color-background` = tint-86 | `rgb(254,235,241)` |
| 卡片面 | `--color-foreground` = tint-92 | 近白带粉 |
| 控件/侧栏 | `--color-widgets` = tint-95 | 更白 |
| 描边 | `--color-border` = tint-78 | 粉灰 |

含义：**改动 `--themecolor` 一个值，整站底色、卡片、描边、控件会一起变色**，
永远不会出现"粉卡片配灰背景"的割裂。复刻时若照抄静态十六进制色，气质立刻丢一半。

其余 tokens〔实测〕：

```
--card-radius: 8px（读者可在设置面板里用滑块改）
卡片：background #fff / border 1px rgba(0,0,0,.05) / shadow 0 2px 4px rgba(0,0,0,.075)
正文：color #525f7f（蓝灰而非纯黑）
字体：Open Sans 300/400/600/700 + Noto Serif SC 300/600（`html.use-serif` 切衬线正文）
版心：#leftbar 280px + 20px padding；#primary = 100% - 280px；>1700px 时 #content 上限 1500px
首屏：.banner 默认 71.8vh；首页 banner-as-cover → 100vh
```

## 3. 版式解剖

**首页**（01）
1. 首屏满屏插画，标题+副标题居中，底部一个下箭头作滚动暗示。
2. 向下滚动后，封面**不再滚动**——它变成整页固定背景（`background-attachment: fixed` 一类的沉浸式处理），
   卡片浮在画上（06 是最直接的证据：卡片之间露出的是同一张插画）。
3. 左栏四张卡：公告（整块粉底白字）→ 片刻 → 搜索 → 作者卡（头像/名/一句简介/文章·分类·标签三计数/6 个图标入口）。
4. 主栏文章流：有封面的卡=缩略图铺满 + 白色渐变蒙版 + 白色标题 + 元信息徽章；无封面=纯文卡，粉标题居中。

**文章页**（05a/05b）
- 同一套 banner-as-cover，只是背景换成文章缩略图；
- 文章卡以负 margin 压在 banner 下沿，标题一开始在图上（白字+投影），正文回落到纸上；
- 正文衬线、留白大、小标题粉色带装饰；评论卡在文末，长评论默认折叠。

**移动端**（04）
- 顶栏退化成「汉堡 | 头像+欢迎语 | 搜索」的胶囊；
- 侧栏变抽屉+遮罩；
- 卡片满宽，元信息自动换行成 3 行——这是唯一允许"信息密度下降"的地方。

## 4. 动效清单（全部实测数值）

只有 9 条，且都遵守"小位移 + 短时长 + 无弹跳"：

| 元素 | 触发 | 属性 | 数值 |
|---|---|---|---|
| `.card` 入场 | 加载/替换 | opacity 0→1, scale(.8)→1，origin center top | `card-show .25s ease-out` |
| 卡片标题 | hover | letter-spacing .5px→1px | `all .35s ease` |
| 顶栏底色 | 滚动 | 背景 alpha 连续插值（起止点=内容顶-75），并同步 backdrop-filter | JS 逐帧写 style，`.3s ease` 兜底 |
| 首屏下箭头 | 滚动过首屏 | opacity 1→0 | `.3s ease` |
| 搜索框 | focus | 输入组宽度/阴影/圆角展开 | `all .5s cubic-bezier(.4,0,0,1)` |
| 图片懒加载 | 进入 800px 阈值 | opacity 0→1（effect: fadeIn） | `.3s ease` |
| 页面跳转 | 点击链接（pjax） | 内容替换 + 顶部 NProgress 进度条 | 配置 600ms |
| 回到顶部 | 点击 | scrollTop → 0 | jQuery `800ms easeOutExpo` |
| 评论"加载更多" | 禁用态 | 呼吸缩放 1→1.2→1 | `breath 2s ease infinite` |

另有：评论区定位高亮 `comment-focus-breath 2s`；通知 toast 用 iziToast 的 fadeInUp；
`#comments > .card-body` 与片刻/说说容器用 `opacity .5s` 淡入；NProgress 转圈 `400ms linear infinite`。

要点：**没有一个动效超过 600ms，没有一处回弹曲线**。整体观感"稳"，是因为动效只做"位移的收尾"，
不承担叙事。主题确实内置了打字机光标动画（`cursor-flash-effect`），但本站**没开**。

## 5. 交互逻辑（状态机层面）

**右下角 FAB 列** `#float_action_buttons`（42×42，间距 8px，`.3s ease`）〔实测 DOM/CSS/JS〕
`#fabtn_reading_progress`（30px 高胶囊，内部 `#fabtn_reading_progress_bar` 用主题色 8% 透明填充表示阅读进度）
→ `#fabtn_go_to_comment`（仅文章页显示）→ `#fabtn_back_to_top` → `#fabtn_toggle_darkmode`
→ `#fabtn_toggle_blog_settings_popup` → `#fabtn_toggle_sides`（整列左右换边，存 localStorage）。

载入时该列带 `fabtns-unloaded`（opacity 0），滚动出现后 300ms 摘掉类名再淡入——避免和首屏动画打架。

**博客设置面板**（07）——把设计决定交给读者：
夜间模式开关（含 AMOLED 纯黑双档）、字体 Sans/Serif、阴影 浅/深、滤镜 关闭·日落·暗化·灰度、圆角滑块（含"恢复默认"）。
全部写 localStorage（`Argon_Use_Serif` 等）。

**夜间模式规则**〔实测内联脚本〕
```js
darkmodeAutoSwitch = "time";                 // 还支持 system / alwayson
// time 模式：hour < 7 || hour >= 22 → 夜间
// 手动切换写 sessionStorage['Argon_Enable_Dark_Mode']，存在即覆盖自动规则
```
注意这是 **sessionStorage**——关掉标签页手动选择就失效、重新回到按时间。这是本站一个可以改进的点。

**pjax**：`disable_pjax: false, pjax_animation_durtion: 600`；站内跳转不整页刷新，
配套 NProgress 顶部进度条；搜索、评论翻页也复用 NProgress。

**其他**：`lazyload{threshold:800, effect:"fadeIn"}`、`fold_long_comments:true`、
`waterflow_columns:"1"`、`headroom:"false"`（顶栏不做滚动隐藏）、`code_highlight.enable:false`。

## 6. 复刻判断

80% 的观感由四件事决定，其余都是细节：
1. **封面即空间**：首屏满屏插画，滚动后转固定背景（不是"顶部一条横幅"）。
2. **纸片卡片**：白面 + 1px 极淡描边 + 8px 圆角 + 0.075 阴影，浮在画上。
3. **单色派生**：一个强调色 + tint 混合算法生成整套表面色。
4. **无刷新 + 低振幅动效**：pjax 过渡、0.25s 卡片入场、0.3s 淡入、0.35s 字距。

抄不动的：选图审美（必须有 2K 以上、色调不与主题色打架的插画）、
人格化内容（头像/公告/片刻/招呼语）。**封面上限 = 设计上限**。

技术映射（若走静态复刻）：
pjax → View Transitions API 或 Swup；WP 搜索 → Pagefind；
原生评论 → giscus/Waline；主题夜间 → `prefers-color-scheme` + 时间规则；
tint 派生 → 同一套 `calc(R + (255-R)*N)` CSS 变量，主题色暴露成一个变量即可换肤。

## 7. 尚未决定

- 技术路线：A 原样 WordPress + Argon / B 静态复刻（Astro） / C 只出规格文档 / D 先做可跑原型。
- 内容侧重：图密（图寻类）与技术文密（代码类）是否要两套排版。
- 封面资产与主题色：沿用粉系人格，还是另立一套。
