/* =============================================================================
   js/fullscreen.js —— 顶栏最右侧的"全屏"按钮

   图标用 SVG mask 画：布局上就是一个 <i class="iconfont">，与搜索/月亮等
   兄弟项完全同一套盒子（inline、14px、坐在基线上），因此天然对齐；
   也不依赖 iconfont 字体本身，CDN 挂了照样能画。
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
  function isOn() {
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
  }

  function sync() {
    var li = doc.getElementById('p-fullscreen-btn');
    if (!li) return;
    var a = li.querySelector('a');
    var on = isOn();
    li.classList.toggle('is-on', on);
    a.setAttribute('aria-label', on ? '退出全屏' : '全屏');
    a.setAttribute('title', on ? '退出全屏' : '全屏');
  }

  function toggle() {
    var fn;
    if (!isOn()) {
      fn = requestFn();
      if (fn) {
        try { var p = fn.call(root); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      }
    } else {
      fn = exitFn();
      if (fn) {
        try { var q = fn.call(doc); if (q && q.catch) q.catch(function () {}); } catch (e) {}
      }
    }
  }

  function mount() {
    var ul = doc.querySelector('#navbar .navbar-nav');
    if (!ul || !requestFn()) return;
    if (doc.getElementById('p-fullscreen-btn')) { sync(); return; }

    var li = doc.createElement('li');
    li.className = 'nav-item';
    li.id = 'p-fullscreen-btn';

    var a = doc.createElement('a');
    a.className = 'nav-link';
    a.href = 'javascript:void(0)';
    a.setAttribute('role', 'button');
    a.setAttribute('tabindex', '0');

    var ico = doc.createElement('i');
    ico.className = 'iconfont p-fs-ico';     // 借用 iconfont 的盒子：inline、14px、基线对齐
    ico.setAttribute('aria-hidden', 'true');
    a.appendChild(ico);

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
