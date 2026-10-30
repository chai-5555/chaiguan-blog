# 第三方组件与许可

本站前端整体以 **AGPL-3.0-or-later** 提供（原因是引入了下面第 1 项）。

| 组件 | 版本 | 许可证 | 用途 | 位置 |
|---|---|---|---|---|
| [audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer) | 4.5.4 | **AGPL-3.0-or-later** | 首屏播放器的频谱可视化（canvas 渲染） | `site/source/js/vendor/audiomotion.js`（原样拷贝自 `node_modules/audiomotion-analyzer/dist/index.js`） |
| [Hexo](https://hexo.io/) | 8.1.2 | MIT | 静态站点生成 | 构建工具，不进入产物 |
| [hexo-theme-fluid](https://github.com/fluid-dev/hexo-theme-fluid) | 1.9.9 | MIT | 主题 | `site/node_modules` |
| 其余前端库（jQuery / Bootstrap / typed.js / nprogress / fancybox 等） | 见 `site/_config.fluid.yml` 的 `static_prefix` | MIT / Apache-2.0 | 主题运行时依赖 | 由主题从 CDN 引入 |

## AGPL 义务说明

audioMotion-analyzer 采用 AGPL-3.0，其网络条款要求：通过网络与使用该库的软件交互的用户，
必须能够获得对应的完整源码。本仓库为公开仓库，源码可获取，满足该要求。

替代方案（若将来希望闭源）：将该库替换为自研实现，或换用 MIT/BSD 许可的等价实现。
