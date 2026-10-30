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

    var idx = 0, playing = false, analyser = null, freq = null, level = null, gate = NaN, rafId = 0, fakeMode = false, zeroSince = 0;

    /* ---------- DOM ---------- */
    var wrap = el('div', 'p-music');
    var barsBox = el('div', 'p-music-bars');
    barsBox.setAttribute('aria-hidden', 'true');
    /* 频谱交给 audioMotion 的 canvas 渲染，这里不再自建柱子 */

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

    function setTrack(i) {
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
      time.textContent = '-00:00';
      fill.style.width = '0%';
    }

    /* ---------- 频谱 ---------- */
    /* —— 频谱：audioMotion-analyzer（v4.5.4，AGPL-3.0-or-later）——
       它自带 AudioContext + canvas 渲染 + 对数频段 + 峰值残留；
       我们只做三件事：给容器、注册站内渐变、跟着播放/暂停 start/stop。
       未加载到库时静默降级（只留进度条，不报错）。 */
    var am = null;

    function ensureAnalyzer() {
      if (am || !window.AudioMotionAnalyzer) return;
      try {
        am = new window.AudioMotionAnalyzer(barsBox, {
          mode: 4,                 // 1/6 倍频程（40Hz–16kHz 约 52 根柱，接近参考图密度）
          frequencyScale: 'log',
          minFreq: 40,
          maxFreq: 16000,
          fftSize: 4096,
          smoothing: 0.78,
          barSpace: 0.25,
          showPeaks: true,
          peakHoldTime: 320,
          minDecibels: -64,        // dB 窗口：柱子吃满高度又不至于整排顶格
          maxDecibels: -18,
          // audioMotion 只有在 showBgColor 为真时才用自定义 bgColor，否则写死画 '#000'
          showBgColor: true,
          bgColor: 'rgba(0,0,0,0)', // 透明底：canvas 只画柱子，露出插画
          bgAlpha: 0,
          alphaBars: false,
          ledBars: false,
          showScaleX: false,
          showScaleY: false,
          showFPS: false,
          connectSpeakers: true
        });
        am.registerGradient('chaiguan', {
          // 填充用 bgColor 兜底；透明必须写在这里，构造参数里的 bgColor 只对内置渐变生效
          bgColor: 'rgba(0,0,0,0)',
          colorStops: [
            { pos: 0, color: '#a55a2a' },
            { pos: 0.55, color: '#c9894f' },
            { pos: 1, color: '#f7eabc' }
          ]
        });
        am.setOptions({ colorMode: 'gradient', gradient: 'chaiguan' });
        am.connectInput(audio);
      } catch (e) {
        am = null;
        barsBox.classList.add('is-fallback');
      }
    }

    function loop(ts) {
      rafId = requestAnimationFrame(loop);
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
      ensureAnalyzer();
      if (am) am.start();
      var p = audio.play();
      if (p && p.catch) p.catch(function () { playing = false; wrap.classList.remove('is-playing'); });
      playing = true;
      wrap.classList.add('is-playing');
      startLoop();
    }
    function pause() {
      audio.pause();
      if (am) am.stop();
      playing = false;
      wrap.classList.remove('is-playing');
      if (REDUCE) stopLoop();
    }

    cover.addEventListener('click', function () { playing ? pause() : play(); });

    audio.addEventListener('playing', function () { wrap.classList.add('is-playing'); startLoop(); });
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
