/* custom.js —— 「暖调纸感」阶段 B
   ---------------------------------------------------------------
   主题 JS 已经负责：导航 scrollTop>50 变实色、视差、下滑箭头、
   返回顶部、进度条、代码复制、图片放大、暗/亮切换。
   这里只补三件主题没做好的事（原生 JS，无任何依赖）：

   1) prefers-reduced-motion 下彻底停掉打字机
      —— typed.js 不看 CSS 媒体查询，光靠 @media 关不掉它，必须拦下 start()。
   2) headless 截图用的临时开关 ?p-color=dark|light
      —— 同时写 data-user-color-scheme、localStorage 与高亮 CSS，手动/自动两套一致。
   3) 主题 JS 缺席时的下滑箭头兜底（平滑滚到 #board）。
*/
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------------------------------------------------------------
     1) reduced-motion：不启动 typed.js，直接写回完整副标题
     --------------------------------------------------------------- */
  function settleSubtitle() {
    var el = document.getElementById('subtitle');
    if (!el) {
      return;
    }
    var full = el.getAttribute('data-typed-text') || el.textContent || '';
    if (full) {
      el.textContent = full;
      el.classList.add('p-typed-settled');
    }
  }

  if (reduceMotion) {
    var typedProto = window.Typed && window.Typed.prototype;
    if (typedProto && typeof typedProto.start === 'function') {
      // 只替换原型方法：主题在 jQuery ready 里调 typed.start()，一并被拦下
      typedProto.start = function () {
        settleSubtitle();
      };
    }
    settleSubtitle();
    document.addEventListener('DOMContentLoaded', settleSubtitle);
  }

  /* ---------------------------------------------------------------
     2) 截图用配色开关：?p-color=dark / ?p-color=light
     --------------------------------------------------------------- */
  var forcedScheme = (/[?&]p-color=(dark|light)\b/.exec(window.location.search) || [])[1];

  function applyHighlightCss(scheme) {
    var lightCss = document.getElementById('highlight-css');
    var darkCss = document.getElementById('highlight-css-dark');
    if (!lightCss || !darkCss) {
      return;
    }
    if (scheme === 'dark') {
      darkCss.removeAttribute('disabled');
      lightCss.setAttribute('disabled', '');
    } else {
      lightCss.removeAttribute('disabled');
      darkCss.setAttribute('disabled', '');
    }
  }

  function applyForcedScheme() {
    if (!forcedScheme) {
      return;
    }
    try {
      window.localStorage.setItem('Fluid_Color_Scheme', forcedScheme);
    } catch (e) {
      /* 隐私模式下 localStorage 可能不可用，忽略 */
    }
    root.setAttribute('data-p-color-forced', forcedScheme);
    root.setAttribute('data-user-color-scheme', forcedScheme);
    applyHighlightCss(forcedScheme);
  }

  if (forcedScheme) {
    applyForcedScheme();
    // 主题的 color-schema.js 在 <head> 里先跑过一轮，这里在两个时机再压一次
    document.addEventListener('DOMContentLoaded', applyForcedScheme);
    window.addEventListener('load', applyForcedScheme);
  }

  /* ---------------------------------------------------------------
     3) 下滑箭头兜底：主题已绑定时不重复绑定，避免滚两次
     --------------------------------------------------------------- */
  function scrollToBoard() {
    var board = document.getElementById('board');
    if (!board) {
      return;
    }
    var navbar = document.getElementById('navbar');
    var offset = navbar ? navbar.offsetHeight : 0;
    var top = board.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({
      top: top < 0 ? 0 : top,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.scroll-down-bar');
    if (!bar) {
      return;
    }
    if (!(window.Fluid && window.Fluid.events && window.jQuery)) {
      bar.addEventListener('click', scrollToBoard);
      bar.setAttribute('role', 'button');
      bar.setAttribute('tabindex', '0');
      bar.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          scrollToBoard();
        }
      });
    }
  });
})();
