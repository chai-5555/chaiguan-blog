/* =============================================================================
   js/fullscreen.js —— 顶栏最右侧的"全屏"按钮

   - 用 SVG 画图标（不依赖 iconfont，CDN 挂了也不会变豆腐块）
   - 支持带前缀的实现；浏览器不支持（如 iOS Safari 对非 video 元素）就完全不渲染
   - router.js 切页会把 <header> 换掉，所以监听 pm:page 重新挂载
   ============================================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  function requestFn() {
    return root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen || null;
  }
  function exitFn() {
    return doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen || null;
  }
  function currentEl() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || null;
  }
  function isOn() { return !!currentEl(); }

  var ICON_EXPAND =
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
    '<path d="M12 3h5v5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M17 3l-5.2 5.2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '<path d="M8 17H3v-5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3 17l5.2-5.2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  var ICON_COLLAPSE =
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
    '<path d="M17 8h-5V3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 8l5.2-5.2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '<path d="M3 12h5v5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M8 12l-5.2 5.2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  function sync() {
    var btn = doc.getElementById('p-fullscreen-btn');
    if (!btn) return;
    var a = btn.querySelector('a');
    var on = isOn();
    a.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
    a.setAttribute('aria-label', on ? '退出全屏' : '全屏');
    a.setAttribute('title', on ? '退出全屏' : '全屏');
    btn.classList.toggle('is-on', on);
  }

  function toggle() {
    var fn;
    if (!isOn()) {
      fn = requestFn();
      if (fn) {
        try {
          var p = fn.call(root);
          if (p && p.catch) p.catch(function () {});
        } catch (e) { /* 用户手势缺失等，静默失败 */ }
      }
    } else {
      fn = exitFn();
      if (fn) {
        try {
          var q = fn.call(doc);
          if (q && q.catch) q.catch(function () {});
        } catch (e) {}
      }
    }
  }

  function mount() {
    var ul = doc.querySelector('#navbar .navbar-nav');
    if (!ul || !requestFn()) return;              // 不支持全屏就干脆不渲染
    if (doc.getElementById('p-fullscreen-btn')) { sync(); return; }
    var li = doc.createElement('li');
    li.className = 'nav-item';
    li.id = 'p-fullscreen-btn';
    var a = doc.createElement('a');
    a.className = 'nav-link';
    a.href = 'javascript:void(0)';
    a.setAttribute('role', 'button');
    a.setAttribute('tabindex', '0');
    a.addEventListener('click', function (ev) { ev.preventDefault(); toggle(); });
    a.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
    });
    li.appendChild(a);
    ul.appendChild(li);
    sync();
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach(function (name) {
    doc.addEventListener(name, sync);
  });
  doc.addEventListener('pm:page', mount);

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
