---
title: Hexo 8 + Fluid：一套能长期维护的博客骨架
date: 2025-10-29 20:10:00
categories: 技术
tags: [Hexo, Fluid, 建站]
---

这次重开博客，目标不是“马上好看”，而是先有一个能跑、能改、不返工的地基。所以第一阶段只做四件事：装上 Hexo 8、挂上 Fluid 主题、配好信息架构、写几篇真文章验证链路。

## 骨架的四个约束

一是主题要能跟上游更新，二是配置优先于代码，三是定制只走覆盖式 CSS，四是本地随时能预览。前两条决定主题怎么装，后两条决定后面阶段怎么写样式。

### 主题为什么用 npm 包而不是 fork

Fluid 直接从 npm 装（`hexo-theme-fluid`），站点配置里只写一行 `theme: fluid`。这样升级只是改个版本号，不会因为动过主题源码而产生冲突；真正需要改版式时，把规则写进 `source/css/custom.css`，通过 Fluid 的 `custom_css` 钩子加载，`node_modules` 保持干净。

## 常用命令

```bash
cd site
npx hexo clean && npx hexo generate   # 生成静态文件到 public/
npx hexo server -p 4100               # 本地预览 http://127.0.0.1:4100
```

`hexo generate` 只读配置和 Markdown，不启服务，适合放进部署脚本；`hexo server` 用来验收路由和样式，验完要记得停掉，别让端口一直占着。

## 上线前要改的四处

1. 站点名与副标题：`_config.yml` 的 `title` 和 `subtitle`，前者是导航栏与页面标题，后者是首页打字机副标题；
2. `url`：先用服务器地址占位，绑定域名后只改这一行，其它地方都用相对路径；
3. banner 图：现在留空走纯色兜底，有素材后放进 `source/img/` 再填路径；
4. 关于页与友链页的正文：目前只是占位空壳，等版式定了再填。

## 下一步

阶段 B 处理配色、字体与暖调纸感，阶段 C 做番剧、书单的实际版式。骨架部分尽量一次做对，后面只往里加内容。
