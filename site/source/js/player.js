/* =============================================================================
   js/player.js —— 首屏音乐模块（封面旋转 / 频谱律动 / 进度 / 剩余时间）

   曲库来自 /audio/playlist.json（由 scripts/music.js 在构建时从 mp3 的 ID3 生成）。
   没有歌就不挂载任何 DOM；音频与页面同源，AnalyserNode 才能拿到真实频谱。
   ============================================================================= */
(function () {
  'use strict';

  var BAR_COUNT = 60;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mmss(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  fetch('/audio/playlist.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (data) {
      var tracks = (data && data.tracks) || [];
      if (tracks.length) mount(tracks);
    });

  function mount(tracks) {
    var banner = document.getElementById('banner');
    if (!banner) return;

    var idx = 0, hasPlayed = false, playing = false, analyser = null, freq = null, level = null, refDb = null, ceilDb = NaN, calFrames = 0, rafId = 0, fakeMode = false, zeroSince = 0;
    var FLOOR = 0.10;   // 柱高基数（0.10 = 最矮 10%）：必须在 mount 作用域，paintBars 与 paintIdle 都要用

    /* ---------- DOM ---------- */
    var wrap = el('div', 'p-music');
    var barsBox = el('div', 'p-music-bars');
    barsBox.setAttribute('aria-hidden', 'true');
    var bars = [];
    for (var i = 0; i < BAR_COUNT; i++) {
      var bar = el('i');
      barsBox.appendChild(bar);
      bars.push(bar);
    }

    var line = el('div', 'p-music-line');
    var track = el('div', 'p-music-track');
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', '播放进度');
    track.tabIndex = 0;
    var fill = el('div', 'p-music-fill');
    var thumb = el('div', 'p-music-thumb');
    track.appendChild(fill);
    track.appendChild(thumb);
    var time = el('span', 'p-music-time', '-00:00');
    line.appendChild(track);
    line.appendChild(time);

    var idBox = el('div', 'p-music-id');
    var cover = el('button', 'p-music-cover');
    cover.type = 'button';
    cover.setAttribute('aria-label', '播放或暂停');
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    cover.appendChild(img);
    var meta = el('div', 'p-music-meta');
    var title = el('div', 'p-music-title', '');
    var artist = el('div', 'p-music-artist', '');
    meta.appendChild(title);
    meta.appendChild(artist);
    idBox.appendChild(cover);
    idBox.appendChild(meta);

    /* 播放列表按钮：与左侧封面左右对称、尺寸更小（图标是"播放三角 + 三行列表"） */
    var listBtn = el('button', 'p-music-listbtn');
    listBtn.type = 'button';
    listBtn.setAttribute('aria-label', '播放列表');
    listBtn.setAttribute('aria-expanded', 'false');
    listBtn.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">' +
      '<path d="M4 4.1 L8.7 6.4 L4 8.7 Z" fill="currentColor"/>' +
      '<rect x="10.2" y="5.3" width="6" height="1.7" rx="0.85" fill="currentColor"/>' +
      '<rect x="4" y="11" width="12.2" height="1.7" rx="0.85" fill="currentColor"/>' +
      '<rect x="4" y="15" width="12.2" height="1.7" rx="0.85" fill="currentColor"/>' +
      '</svg>';
    idBox.appendChild(listBtn);

    wrap.appendChild(barsBox);
    wrap.appendChild(line);
    wrap.appendChild(idBox);
    wrap.hidden = true;
    banner.appendChild(wrap);
    banner.classList.add('has-music');   // 播放器占底边时收起下滑箭头（见 custom.css §18）

    /* ---------- audio ---------- */
    var audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.85;
    audio.hidden = true;
    wrap.appendChild(audio);   // 挂在 DOM 里（便于调试与部分移动端行为一致）

    function resetFake() { fakeMode = false; zeroSince = 0; }

    function setTrack(i) {
      resetFake();
      idx = (i + tracks.length) % tracks.length;
      var t = tracks[idx];
      audio.src = t.src;
      title.textContent = t.title;
      artist.textContent = t.album ? t.artist + ' · ' + t.album : t.artist;
      if (t.cover) {
        img.src = t.cover;
        img.alt = t.title;
      } else {
        img.removeAttribute('src');
        img.alt = '';
      }
      cover.classList.toggle('is-nocover', !t.cover);
      cover.dataset.initial = (t.title || '?').trim().charAt(0).toUpperCase();
      wrap.hidden = false;
      ceilDb = NaN;   // 换歌重置 AGC
      time.textContent = '-00:00';
      fill.style.width = '0%';
      markActive();
    }

    /* ---------- 播放列表抽屉 ---------- */
    var drawer = null;

    function markActive() {
      if (!drawer) return;
      var items = drawer.querySelectorAll('.p-playlist-item');
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-active', Number(items[i].dataset.i) === idx);
      }
    }

    function ensureDrawer() {
      if (drawer) return drawer;
      drawer = el('aside', 'p-playlist');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('aria-label', '播放列表');
      drawer.innerHTML =
        '<div class="p-playlist-head">' +
        '<span class="p-playlist-h">播放列表</span>' +
        '<span class="p-playlist-count"></span>' +
        '<button type="button" class="p-playlist-close" aria-label="关闭播放列表">&times;</button>' +
        '</div><ol class="p-playlist-list"></ol>';
      document.body.appendChild(drawer);
      drawer.querySelector('.p-playlist-count').textContent = tracks.length + ' 首';

      var list = drawer.querySelector('.p-playlist-list');
      tracks.forEach(function (t, i) {
        var li = el('li');
        var btn = el('button', 'p-playlist-item');
        btn.type = 'button';
        btn.dataset.i = i;
        btn.innerHTML = '<span class="p-playlist-idx"></span>' +
          '<span class="p-playlist-meta"><span class="p-playlist-title"></span><span class="p-playlist-artist"></span></span>';
        btn.querySelector('.p-playlist-idx').textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
        btn.querySelector('.p-playlist-title').textContent = t.title;
        btn.querySelector('.p-playlist-artist').textContent = t.album ? t.artist + ' · ' + t.album : t.artist;
        btn.addEventListener('click', function () {
          setTrack(i);
          play();
          markActive();
          closeDrawer();
        });
        li.appendChild(btn);
        list.appendChild(li);
      });

      drawer.querySelector('.p-playlist-close').addEventListener('click', closeDrawer);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
      document.addEventListener('pointerdown', function (e) {
        if (!drawer.classList.contains('is-open')) return;
        if (drawer.contains(e.target) || listBtn.contains(e.target)) return;
        closeDrawer();
      });
      return drawer;
    }

    function openDrawer() {
      ensureDrawer();
      markActive();
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      listBtn.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
      if (!drawer) return;
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      listBtn.setAttribute('aria-expanded', 'false');
    }

    listBtn.addEventListener('click', function () {
      if (drawer && drawer.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    });

    /* ---------- 频谱 ---------- */
    function ensureAnalyser() {
      if (analyser) { if (analyser.context.state === 'suspended') analyser.context.resume(); return; }
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { fakeMode = true; return; }
      try {
        var ctx = new Ctx();
        var src = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.62;   // 帧内平滑少一点，靠下面的攻/释放包络控制手感
        src.connect(analyser);
        analyser.connect(ctx.destination);
        /* 创建后立刻 resume：MediaElementSource 一旦接到 suspended 的 AudioContext，
           媒体元素会卡在 currentTime=0、分析器永远读到 -Infinity，
           表现就是"歌像在放、频谱却是一条上扬的斜坡" */
        if (ctx.state === 'suspended') ctx.resume();
        freq = new Float32Array(analyser.frequencyBinCount);   // getFloatFrequencyData：dBFS，绝对值
        level = new Float32Array(BAR_COUNT);                   // 每根柱子当前的显示电平（0–1）
        ceilDb = NaN;                                          // 整轨校准出的窗口天花板（只校准一次）
        calFrames = 0;
      } catch (e) {
        fakeMode = true;
      }
    }

    /* 调参用探针：仅在 ?p-music-debug=1 时暴露分析器，正常访问不产生任何全局变量 */
    if (location.search.indexOf('p-music-debug') >= 0) {
      window.__pMusicDebug = { get analyser() { return analyser; }, get freq() { return freq; }, get level() { return level; }, get isFake() { return fakeMode; }, get playing() { return playing; } };
    }

    function paintBars(ts) {
      var i, h;
      if (fakeMode) {
        if (!playing) return;                     // 暂停时停在最后一帧，不再滚动画
        for (i = 0; i < BAR_COUNT; i++) {
          h = (Math.sin(ts / 520 + i * 0.7) * 0.5 + 0.5) * (0.45 + 0.55 * Math.sin(ts / 1400 + i * 0.31));
          bars[i].style.height = Math.max(2, h * 100).toFixed(1) + '%';
        }
        return;
      }
      analyser.getFloatFrequencyData(freq);   // 单位 dBFS：-100 ≈ 静音，0 = 满刻度

      /* 每根柱子用"自己的长期参考电平"做归一化：
         - 参考电平追峰值很快、回落很慢（≈5 dB/秒），所以副歌会把整排推上去、
           而安静段在参考电平回落的这几秒里明显变矮 —— 低谷/高潮就分得出来了
         - 每根柱子各有一条参考，天然抵消音乐 50 dB 的高频滚降（实测第 0 根 p50 ≈ -57 dB，
           第 54 根 p50 ≈ -106 dB，用同一个固定窗口必然高音区全死）
         - 不再用"当前帧最响那根"做分母：那会把每一帧都拉满，正是此前没有起伏的原因 */
      /* —— 自研频谱 v3 ——
         1) 等比频段 40Hz→16kHz + 常数倾斜补偿：整体形状稳定，低频厚、高频不塌
         2) 跨柱 3 抽头平滑：相邻柱子联动，眼睛才能看出"山丘在动"而不是随机噪点
         3) 全局慢 AGC（只动整体电平，不动柱间对比）：主歌/副歌的高低位由它给出
         4) 快攻慢放的显示包络 */
      var RANGE_DB = 32;                              // 窗口宽度（dB）：越窄对比越强
      var F_MIN = 40, F_MAX = 16000;
      var TILT = 4.0;                                 // 每倍频程补偿（dB）
      var binHz = (analyser.context.sampleRate || 48000) / analyser.fftSize;
      var lnRatio = Math.log(F_MAX / F_MIN);
      var raw = new Array(BAR_COUNT);
      var rawDb = new Array(BAR_COUNT);
      var centers = new Array(BAR_COUNT);
      var frameMax = -Infinity;
      var dbMax = -Infinity;

      for (i = 0; i < BAR_COUNT; i++) {
        var f0 = F_MIN * Math.exp(lnRatio * i / BAR_COUNT);
        var f1 = F_MIN * Math.exp(lnRatio * (i + 1) / BAR_COUNT);
        var a2 = Math.max(1, Math.floor(f0 / binHz));
        var b2 = Math.max(a2 + 1, Math.ceil(f1 / binHz));
        var db = -Infinity;
        for (var k = a2; k < b2 && k < freq.length; k++) if (freq[k] > db) db = freq[k];
        if (!isFinite(db)) db = -110;
        rawDb[i] = db;
        centers[i] = Math.sqrt(f0 * f1);
        if (db > dbMax) dbMax = db;
      }

      /* 没有真信号时（音频还没解码出来 / 静音段 / 分析器读到的是纯底噪），
         绝不能继续走"倾斜补偿 + AGC"：底噪在每个频段都一样，加上随频率递增的
         倾斜量后就会画成一条从左到右上扬的斜坡（这就是你截图里那个形状）。
         这里回落到"静止态"，目标高度与 CSS 里 .p-music-bars > i 的初始 20% 对齐，
         这样"刚进站"和"点了播放但还没加载"看到的是同一种画面。 */
      /* 两种"没内容"要分开：
         ① 还没解码出数据（readyState<2）→ 20% 平线，跟刚进站/点了播放还没加载时一致
         ② 真的在播但这一段没声音（前奏空档、尾音）→ 落到 FLOOR（10%）平线
         两种都保持 flat、不动 AGC，也**不再切随机动画** */
      var notLoaded = audio.readyState < 2;
      var silent = !notLoaded && (!isFinite(dbMax) || dbMax < -92);
      if (notLoaded || silent) {
        var rest = notLoaded ? 0.20 : FLOOR;
        for (i = 0; i < BAR_COUNT; i++) {
          level[i] += (rest - level[i]) * 0.12;
          bars[i].style.height = Math.max(2, level[i] * 100).toFixed(1) + '%';
        }
        return;
      }

      for (i = 0; i < BAR_COUNT; i++) {
        raw[i] = rawDb[i] + Math.max(-20, Math.min(20, TILT * Math.log(centers[i] / 1000) / Math.LN2));
        if (raw[i] > frameMax) frameMax = raw[i];
      }

      /* 全局慢 AGC：天花板跟整排峰值，跟涨 ~1s、回落 ~12s（慢到不会把副歌压回主歌的高度） */
      if (!isFinite(ceilDb)) ceilDb = frameMax;
      ceilDb += (frameMax - ceilDb) * (frameMax > ceilDb ? 0.08 : 0.010);
      var floorDb = ceilDb - RANGE_DB;

      /* 跨柱平滑：raw → 3 抽头加权，[1,2,1]/4 */
      for (i = 0; i < BAR_COUNT; i++) {
        var prev = raw[Math.max(0, i - 1)];
        var next = raw[Math.min(BAR_COUNT - 1, i + 1)];
        var sm = (prev + 2 * raw[i] + next) / 4;

        var target = (sm - floorDb) / RANGE_DB;
        target = Math.max(0, Math.min(1, target));
        var cur = level[i];
        cur += (target - cur) * (target > cur ? 0.60 : 0.16);
        level[i] = cur;
        bars[i].style.height = Math.max(2, Math.min(100, (FLOOR + cur * (1 - FLOOR)) * 100)).toFixed(1) + '%';
      }
    }

    /* 进站未播放的占位动画：柔和的正弦叠加（不是频谱，纯装饰）。
       一旦播放过（hasPlayed）就永久不再使用——这正是之前那个 bug 的根因。 */
    function paintIdle(ts) {
      for (var i = 0; i < BAR_COUNT; i++) {
        var base = Math.sin(ts / 900 + i * 0.55) * 0.5 + 0.5;
        var wave = Math.sin(ts / 2100 + i * 0.21) * 0.5 + 0.5;
        var v = base * 0.55 + wave * 0.45;
        bars[i].style.height = Math.max(2, (FLOOR + v * (1 - FLOOR) * 0.55) * 100).toFixed(1) + '%';
      }
    }

    function loop(ts) {
      rafId = requestAnimationFrame(loop);
      if (playing) paintBars(ts);            // 暂停后停在一帧，不再重绘
      else if (!hasPlayed) paintIdle(ts);    // 进站未播放：柔和占位动画
      var d = audio.duration;
      if (isFinite(d) && d > 0) {
        var pct = Math.min(100, (audio.currentTime / d) * 100);
        fill.style.width = pct + '%';
        thumb.style.left = pct + '%';
        time.textContent = '-' + mmss(d - audio.currentTime);
      }
    }

    function startLoop() {
      if (!rafId) rafId = requestAnimationFrame(loop);
    }
    function stopLoop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    /* ---------- 播放控制 ---------- */
    function play() {
      hasPlayed = true;
      resetFake();
      ensureAnalyser();
      var p = audio.play();
      if (p && p.catch) p.catch(function () { playing = false; wrap.classList.remove('is-playing'); });
      playing = true;
      wrap.classList.add('is-playing');
      startLoop();
    }
    function pause() {
      audio.pause();
      playing = false;
      wrap.classList.remove('is-playing');
      if (REDUCE) stopLoop();
    }

    cover.addEventListener('click', function () { playing ? pause() : play(); });

    audio.addEventListener('playing', function () { resetFake(); wrap.classList.add('is-playing'); startLoop(); });
    audio.addEventListener('pause', function () { wrap.classList.remove('is-playing'); });
    audio.addEventListener('ended', function () { setTrack(idx + 1); play(); });
    audio.addEventListener('error', function () { if (tracks.length > 1) { setTrack(idx + 1); if (playing) play(); } });

    /* ---------- 拖动进度 ---------- */
    function seekFromEvent(ev) {
      var r = track.getBoundingClientRect();
      var cx = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : (ev.clientX != null ? ev.clientX : ev.pageX);
      var x = cx - r.left;
      var ratio = Math.max(0, Math.min(1, x / r.width));
      if (isFinite(audio.duration)) audio.currentTime = ratio * audio.duration;
      fill.style.width = (ratio * 100) + '%';
      thumb.style.left = (ratio * 100) + '%';
    }
    var dragging = false;
    track.addEventListener('pointerdown', function (ev) {
      dragging = true;
      try { track.setPointerCapture(ev.pointerId); } catch (e) { /* 某些合成事件没有有效 pointerId */ }
      seekFromEvent(ev);
    });
    track.addEventListener('pointermove', function (ev) { if (dragging) seekFromEvent(ev); });
    track.addEventListener('pointerup', function (ev) { dragging = false; try { track.releasePointerCapture(ev.pointerId); } catch (e) {} });
    track.addEventListener('click', function (ev) { if (!dragging) seekFromEvent(ev); });
    track.addEventListener('keydown', function (ev) {
      if (!isFinite(audio.duration)) return;
      if (ev.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); ev.preventDefault(); }
    });

    setTrack(0);
    if (!REDUCE) startLoop();   // 进站就开始占位动画（浏览器在标签页隐藏时会自动节流 rAF）
    if (REDUCE) {
      // 减少动效：不跑 rAF，条形固定中位，只在 timeupdate 里更新进度
      bars.forEach(function (b, i) { b.style.height = (30 + ((i * 37) % 40)) + '%'; });
      audio.addEventListener('timeupdate', function () {
        var d = audio.duration;
        if (isFinite(d) && d > 0) {
          var pct = Math.min(100, (audio.currentTime / d) * 100);
          fill.style.width = pct + '%';
          thumb.style.left = pct + '%';
          time.textContent = '-' + mmss(d - audio.currentTime);
        }
      });
    }
  }
})();
