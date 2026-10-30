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

    var idx = 0, playing = false, analyser = null, freq = null, rafId = 0, fakeMode = false, zeroSince = 0;

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
    function ensureAnalyser() {
      if (analyser) { if (analyser.context.state === 'suspended') analyser.context.resume(); return; }
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { fakeMode = true; return; }
      try {
        var ctx = new Ctx();
        var src = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.82;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        freq = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
        fakeMode = true;
      }
    }

    function paintBars(ts) {
      var i, h;
      if (fakeMode) {
        for (i = 0; i < BAR_COUNT; i++) {
          h = (Math.sin(ts / 520 + i * 0.7) * 0.5 + 0.5) * (0.45 + 0.55 * Math.sin(ts / 1400 + i * 0.31));
          bars[i].style.height = Math.max(2, h * 100).toFixed(1) + '%';
        }
        return;
      }
      analyser.getByteFrequencyData(freq);
      var max = 0;
      for (i = 0; i < freq.length; i++) if (freq[i] > max) max = freq[i];
      if (playing && max === 0) {
        if (!zeroSince) zeroSince = ts;
        else if (ts - zeroSince > 1200) fakeMode = true;   // 跨域污染等情况下退化为假跳
      } else {
        zeroSince = 0;
      }
      /* 音乐能量集中在 ~10kHz 以下（fftSize 1024 → 每 bin ≈ 47Hz），
         取前 42% 的 bin 再按指数拉开，右端不再全空；高频段给一点补偿增益抵消频谱滚降 */
      var usable = Math.floor(freq.length * 0.42);
      var vals = new Array(BAR_COUNT);
      var peak = 1;
      for (i = 0; i < BAR_COUNT; i++) {
        var a = Math.floor(Math.pow(i / BAR_COUNT, 1.25) * usable);
        var b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BAR_COUNT, 1.25) * usable));
        var v = 0;
        for (var k = a; k < b && k < freq.length; k++) if (freq[k] > v) v = freq[k];  // 取峰值比均值更有起伏
        vals[i] = v;
        if (v > peak) peak = v;
      }
      for (i = 0; i < BAR_COUNT; i++) {
        /* 逐帧归一化 + 0.7 次幂：音乐高频本来就很弱，不归一化右半边会一直贴地 */
        var r = Math.pow(vals[i] / peak, 0.7);
        var tilt = 0.72 + 0.36 * (i / BAR_COUNT);
        bars[i].style.height = Math.max(2, Math.min(100, r * 100 * tilt)).toFixed(1) + '%';
      }
    }

    function loop(ts) {
      rafId = requestAnimationFrame(loop);
      if (analyser || fakeMode) paintBars(ts);
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
