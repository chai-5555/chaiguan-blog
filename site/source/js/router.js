/* =============================================================================
   js/router.js —— 站内无刷新导航（自研精简版 pjax）

   目的：让首屏音乐播放器不随页面切换重建（<audio> 元素常驻在 body 上的独立宿主里）。

   做法：
     1) 拦截同源、无 target=_blank、无 hash 的 <a> 点击
     2) fetch 目标页 HTML → DOMParser 解析 → 只替换 <header> 与 <main>
     3) 重新执行被替换区域里的内联脚本（innerHTML 插入的脚本不会自动执行）
     4) 调主题的初始化入口 Fluid.boot.registerEvents() / refresh()
     5) pushState + popstate 支持前进后退；任何异常都回退成整页跳转
   ============================================================================= */
(function () {
  'use strict';

  if (!window.fetch || !window.history || !window.DOMParser || !window.Promise) return;
  if (window.__pRouterLoaded) return;
  window.__pRouterLoaded = true;

  var CONTAINERS = ['header', 'main'];
  var scriptCache = {};
  var navigating = false;

  function eligible(a) {
    if (!a || !a.href) return false;
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#') return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    if (/^(mailto|tel|javascript):/i.test(raw)) return false;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return false;
      if (u.pathname === location.pathname && u.search === location.search && u.hash) return false;
      if (u.href === location.href) return false;
      return true;
    } catch (e) { return false; }
  }

  /* 把区域内 <script> 换成新节点，浏览器才会执行（src 去重，避免主题脚本重复加载） */
  function reviveScripts(root) {
    var list = [].slice.call(root.querySelectorAll('script'));
    list.forEach(function (old) {
      var src = old.getAttribute('src');
      if (src) {
        var abs = new URL(src, location.href).href;
        if (scriptCache[abs]) { old.parentNode.removeChild(old); return; }
        scriptCache[abs] = true;
      }
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) s.setAttribute(old.attributes[i].name, old.attributes[i].value);
      s.text = old.text;
      old.parentNode.replaceChild(s, old);
    });
  }

  function reinit() {
    try {
      if (window.Fluid && Fluid.boot) {
        Fluid.boot.registerEvents();
        Fluid.boot.refresh();
      }
    } catch (e) { /* 主题内部报错不影响导航 */ }
    document.dispatchEvent(new CustomEvent('pm:page'));
  }

  function swap(doc) {
    CONTAINERS.forEach(function (sel) {
      try {
      var cur = document.querySelector(sel);
      var next = doc.querySelector(sel);
      if (!cur || !next) return;
      cur.replaceWith(document.importNode(next, true));
      } catch (e) { /* 单个容器替换失败不影响另一个，也不冒泡成导航失败 */ }
    });
    if (doc.title) document.title = doc.title;
    if (doc.body && doc.body.className) document.body.className = doc.body.className;
    CONTAINERS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) reviveScripts(el);
    });
    window.scrollTo(0, 0);
    reinit();
  }

  function go(url, push) {
    if (navigating) return;
    navigating = true;
    if (window.nprogress) nprogress.start();
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        if (!doc.querySelector('main') || !doc.querySelector('header')) throw new Error('unexpected layout');
        /* 先改地址再换内容：swap 里会派发 pm:page，监听方（播放器等）需要读到的
           已经是新路径，否则会按旧页面判断状态 */
        if (push) history.pushState({ pm: 1 }, '', url);
        swap(doc);
      })
      .catch(function () {
        location.href = url;          // 任何失败都退回整页跳转，保证可用
      })
      .then(function () {
        navigating = false;
        if (window.nprogress) nprogress.done();
      });
  }

  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest ? ev.target.closest('a') : null;
    if (!eligible(a)) return;
    ev.preventDefault();
    go(a.href, true);
  }, false);

  window.addEventListener('popstate', function () {
    go(location.href, false);
  });

  /* 让外部（如播放器）能手动触发一次导航 */
  window.pmNavigate = function (url) { go(url, true); };
})();
