/* global hexo */
'use strict';

/* =============================================================================
   scripts/pages.js —— 站点级脚本（Hexo 启动时自动加载 scripts/*.js）

   职责只有两件事，都在最终 HTML 上做，主题模板零改动：
     1) 把内容页里的占位标记 <div class="p-mount" data-p="bangumi"></div>
        替换成由 source/_data/<type>.yml 生成的 HTML；
     2) 给这些页面的 <body> 打上作用域类 page-bangumi / page-books /
        page-about / page-links，让 pages.css 的样式不会外溢到首页与文章页。

   没有占位标记的页面（首页、归档、文章）原样返回，一个字节都不碰。
   加内容只改 source/_data/*.yml，不需要碰本文件，也不需要碰 .md。
   ============================================================================= */

/* Hexo 主题 hexo-theme-fluid 的 scripts/generators/pages.js 会无条件生成一份
   /links/index.html（layout: links，内容取自 _config.fluid.yml 的 links.items），
   与本仓库 source/links/index.md 抢同一个输出路径，且主题那份后写、覆盖掉本地页。
   这里只在内存里关掉它的开关——_config.fluid.yml 一个字节都不改——让 /links/ 回到
   普通页面布局，由本脚本用 source/_data/links.yml 渲染。 */
hexo.extend.filter.register('before_generate', function () {
  const conf = this.theme && this.theme.config;
  if (conf && conf.links) conf.links.enable = false;
});

const MOUNT_RE = /<div class="p-mount" data-p="(bangumi|books|about|links)"><\/div>/;

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return s.replace(/[&<>"']/g, function (c) { return HTML_ESC[c]; });
}

/* FNV-1a：把标题字符串稳定折成 32 位整数，同一标题永远得到同一色调 */
function fnv1a(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* 占位封面 / 头像的色调参数。
   色相始终来自 --p-accent / --p-accent-2 两个 token，只有「混入比例」和「渐变角度」
   由标题 hash 派生：亮暗两套 token 会自动成立，页面里不出现任何新颜色字面量。 */
function toneVars(seed) {
  const h = fnv1a(seed);
  const tone = 18 + (h % 38);
  const tone2 = 6 + ((h >>> 5) % 25);
  const tilt = 100 + ((h >>> 11) % 56);
  return '--p-tone:' + tone + '%;--p-tone-2:' + tone2 + '%;--p-tilt:' + tilt + 'deg';
}

function initialOf(item, fallback) {
  const raw = item.initial || item.title || item.name || fallback || '';
  const first = Array.from(String(raw).trim())[0] || '?';
  return esc(first.toUpperCase());
}

const STATUS_CLASS = {
  '在看': 'is-watching',
  '已看': 'is-done',
  '搁置': 'is-paused',
  '在读': 'is-reading',
  '读完': 'is-done',
  '想读': 'is-wish'
};

function badge(status) {
  if (!status) return '';
  const key = String(status).trim();
  const cls = STATUS_CLASS[key] || 'is-other';
  return '<span class="p-badge ' + cls + '">' + esc(key) + '</span>';
}

function scoreNode(score) {
  const n = Number(score);
  if (!isFinite(n) || n <= 0) return '<span class="p-score p-score--nil" aria-label="未评分">—</span>';
  const s = Math.min(10, Math.max(0, n));
  const pct = Math.round(s * 10);
  return '<span class="p-score" title="评分 ' + s.toFixed(1) + ' / 10">' +
    '<span class="p-score-num">' + s.toFixed(1) + '</span>' +
    '<span class="p-score-bar" aria-hidden="true"><i class="p-score-fill" style="--p-score:' + pct + '%"></i></span>' +
    '</span>';
}

function coverNode(item, kind, extraClass) {
  const cls = 'p-cover' + (extraClass ? ' ' + extraClass : '');
  const title = item.title || item.name || '';
  if (item.cover) {
    return '<span class="' + cls + '"><img class="p-cover-img" src="' + esc(item.cover) +
      '" alt="' + esc(title) + '" loading="lazy"></span>';
  }
  return '<span class="' + cls + '" style="' + toneVars(title || kind) + '" aria-hidden="true">' +
    '<span class="p-cover-glyph">' + initialOf(item, kind) + '</span></span>';
}

function pageHead(page, stats) {
  page = page || {};
  const out = [];
  if (page.kicker) out.push('<p class="p-kicker">' + esc(page.kicker) + '</p>');
  if (page.title) out.push('<h2 class="p-page-title">' + esc(page.title) + '</h2>');
  if (page.lead) out.push('<p class="p-page-lead">' + esc(page.lead) + '</p>');
  if (stats) out.push('<p class="p-page-stats">' + esc(stats) + '</p>');
  return '<header class="p-page-head">' + out.join('') + '</header>';
}

function listOf(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function countBy(items, key) {
  const m = {};
  for (let i = 0; i < items.length; i++) {
    const k = String(items[i][key] || '未标注');
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function statLine(items, unit) {
  if (!items.length) return '还没有条目，去 source/_data 里加一条试试';
  const by = countBy(items, 'status');
  const parts = Object.keys(by).map(function (k) { return k + ' ' + by[k]; });
  return '共 ' + items.length + ' ' + unit + (parts.length ? ' · ' + parts.join(' · ') : '');
}

function renderBangumi(data) {
  const d = data || {};
  const items = listOf(d.items);
  const cards = items.map(function (it) {
    const meta = [];
    if (it.status) meta.push(badge(it.status));
    if (it.year) meta.push('<span class="p-meta-year">' + esc(it.year) + '</span>');
    meta.push(scoreNode(it.score));
    return '<article class="p-card p-anime">' +
      coverNode(it, '番') +
      '<div class="p-card-body">' +
        '<h3 class="p-card-title">' + esc(it.title) + '</h3>' +
        (it.orig ? '<p class="p-card-orig">' + esc(it.orig) + '</p>' : '') +
        '<p class="p-card-meta">' + meta.join('') + '</p>' +
        (it.note ? '<p class="p-card-note">' + esc(it.note) + '</p>' : '') +
      '</div></article>';
  });
  return '<div class="p-page p-page-bangumi">' +
    pageHead(d.page, statLine(items, '部')) +
    '<div class="p-grid p-grid-anime">' + cards.join('') + '</div>' +
    '</div>';
}

function renderBooks(data) {
  const d = data || {};
  const items = listOf(d.items);
  const cards = items.map(function (it) {
    const meta = [];
    if (it.status) meta.push(badge(it.status));
    meta.push(scoreNode(it.score));
    return '<article class="p-card p-book">' +
      coverNode(it, '书', 'p-cover--chip') +
      '<div class="p-card-body">' +
        '<h3 class="p-card-title">' + esc(it.title) + '</h3>' +
        (it.author ? '<p class="p-book-author">' + esc(it.author) + '</p>' : '') +
        '<p class="p-card-meta">' + meta.join('') + '</p>' +
        (it.note ? '<p class="p-card-note">' + esc(it.note) + '</p>' : '') +
      '</div></article>';
  });
  return '<div class="p-page p-page-books">' +
    pageHead(d.page, statLine(items, '本')) +
    '<div class="p-grid p-grid-books">' + cards.join('') + '</div>' +
    '</div>';
}

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function renderLinks(data) {
  const d = data || {};
  const items = listOf(d.items);
  const cards = items.map(function (it) {
    return '<a class="p-link-card" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' +
      coverNode(it, '友', 'p-avatar p-avatar--sm') +
      '<span class="p-link-text">' +
        '<span class="p-link-name">' + esc(it.name) + '</span>' +
        (it.desc ? '<span class="p-link-desc">' + esc(it.desc) + '</span>' : '') +
        '<span class="p-link-host">' + esc(it.host || hostOf(it.url)) + '</span>' +
      '</span></a>';
  });
  const foot = d.apply ? '<p class="p-page-foot">' + esc(d.apply) + '</p>' : '';
  const stats = items.length ? '共 ' + items.length + ' 位邻居' : '还没有邻居';
  return '<div class="p-page p-page-links">' +
    pageHead(d.page, stats) +
    '<div class="p-grid p-grid-links">' + cards.join('') + '</div>' + foot +
    '</div>';
}

function levelPct(lv) {
  const n = Number(lv);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(Math.min(5, n) / 5 * 100);
}

/* 头像 / 名字 / 一行 intro / 图标由 Fluid 原生 about 版式渲染
   （layout/about.ejs 取 _config.fluid.yml 的 about 段），这里只输出正文三块：
   自我介绍 / 技能条 / 联系方式，不再重复输出头像与名字。 */
function renderAbout(data) {
  const d = data || {};
  const intro = listOf(d.intro);
  const skills = listOf(d.skills);
  const contact = listOf(d.contact);

  const introHtml = intro.length
    ? '<section class="p-sec">' +
      (d.introTitle ? '<h3 class="p-sec-title">' + esc(d.introTitle) + '</h3>' : '') +
      '<div class="p-prose">' + intro.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' +
      '</section>'
    : '';

  const skillHtml = skills.length
    ? '<section class="p-sec">' +
      (d.skillsTitle ? '<h3 class="p-sec-title">' + esc(d.skillsTitle) + '</h3>' : '') +
      '<ul class="p-skills">' + skills.map(function (s) {
        return '<li class="p-skill">' +
          '<span class="p-skill-name">' + esc(s.name) + '</span>' +
          (s.note ? '<span class="p-skill-note">' + esc(s.note) + '</span>' : '') +
          '<span class="p-skill-bar" aria-hidden="true"><i style="--p-level:' + levelPct(s.level) + '%"></i></span>' +
          '</li>';
      }).join('') + '</ul></section>'
    : '';

  const contactHtml = contact.length
    ? '<section class="p-sec">' +
      (d.contactTitle ? '<h3 class="p-sec-title">' + esc(d.contactTitle) + '</h3>' : '') +
      '<ul class="p-contact">' + contact.map(function (c) {
        return '<li class="p-contact-row">' +
          '<span class="p-contact-label">' + esc(c.label) + '</span>' +
          '<span class="p-contact-value">' + esc(c.value) + '</span>' +
          '</li>';
      }).join('') + '</ul></section>'
    : '';

  return '<div class="p-page p-page-about">' + introHtml + skillHtml + contactHtml + '</div>';
}

/* 主题 layout/about.ejs 的图标 <a> 只有 target="_blank"，没有 rel="noopener"。
   主题在 node_modules 里、不改；在生成结果里只补这一块，其它 <a> 不动。 */
function hardenAboutIcons(html) {
  return html.replace(/<div class="about-icons">[\s\S]*?<\/div>/, function (block) {
    return block.replace(/<a /g, '<a rel="noopener" ');
  });
}

const TYPES = {
  bangumi: renderBangumi,
  books: renderBooks,
  about: renderAbout,
  links: renderLinks
};

hexo.extend.filter.register('after_render:html', function (str) {
  if (typeof str !== 'string' || str.indexOf('p-mount') === -1) return str;
  // 只处理最终文档；Markdown 片段渲染阶段没有 <body>，直接放行，避免只替换一半。
  if (!/<body[\s>]/.test(str)) return str;
  const m = MOUNT_RE.exec(str);
  if (!m) return str;
  const type = m[1];
  const data = (hexo.locals.get('data') || {})[type];
  const html = TYPES[type](data);
  let out = str.replace(MOUNT_RE, function () { return html; });
  if (type === 'about') out = hardenAboutIcons(out);
  out = out.replace(/<body(\s[^>]*)?>/, function (tag, attrs) {
    attrs = attrs || '';
    if (/\bclass=/.test(attrs)) {
      return '<body' + attrs.replace(/class="([^"]*)"/, 'class="page-' + type + ' $1"') + '>';
    }
    return '<body class="page-' + type + '"' + attrs + '>';
  });
  return out;
});
