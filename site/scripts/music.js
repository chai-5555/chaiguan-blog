/* global hexo */
'use strict';

/* =============================================================================
   scripts/music.js —— 曲库构建器（自包含 ID3v2 解析，零外部依赖）

   扫 source/audio/*.mp3，从文件本身的 ID3v2 标签读出标题 / 艺术家 / 专辑 / 内嵌封面：
     · 生成 source/audio/playlist.json  → 前端 fetch('/audio/playlist.json')
     · 内嵌封面解到 source/img/covers/<hash>.<ext>
   封面兜底：ID3 APIC → 同名旁挂图（song.jpg/png/webp）→ 前端画占位
   时长不在构建期算：播放器用 <audio> 的 loadedmetadata 拿，省一次 MP3 帧扫描。

   Hexo 的 scripts/*.js 跑在 vm 沙箱里，不能用动态 import，所以这里自己解析标签，
   不依赖 ESM-only 的 music-metadata。
   ============================================================================= */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIO_DIR = 'source/audio';
const COVER_DIR = 'source/img/covers';
const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const SIDECAR = ['.jpg', '.jpeg', '.png', '.webp'];

function syncsafe(buf, off) {
  return ((buf[off] & 0x7f) << 21) | ((buf[off + 1] & 0x7f) << 14) | ((buf[off + 2] & 0x7f) << 7) | (buf[off + 3] & 0x7f);
}

function decodeText(buf, enc) {
  if (!buf.length) return '';
  try {
    if (enc === 0) return buf.toString('latin1').replace(/\0+$/, '').trim();
    if (enc === 1) {
      if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le').replace(/\0+$/, '').trim();
      if (buf[0] === 0xfe && buf[1] === 0xff) return buf.slice(2).swap16().toString('utf16le').replace(/\0+$/, '').trim();
      return buf.toString('utf16le').replace(/\0+$/, '').trim();
    }
    if (enc === 2) return buf.swap16().toString('utf16le').replace(/\0+$/, '').trim();
    return buf.toString('utf8').replace(/\0+$/, '').trim();
  } catch (e) {
    return '';
  }
}

/* 读一个 mp3 的 ID3v2 标签；只解析需要的四个帧，够用就好 */
function readId3(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(10);
    if (fs.readSync(fd, head, 0, 10, 0) !== 10) return null;
    if (head.toString('ascii', 0, 3) !== 'ID3') return null;
    const major = head[3];
    const tagSize = syncsafe(head, 6);
    if (!tagSize || tagSize > 20 * 1024 * 1024) return null;
    const body = Buffer.alloc(tagSize);
    fs.readSync(fd, body, 0, tagSize, 10);

    const out = { title: '', artist: '', album: '', picture: null, version: major };
    const idLen = major === 2 ? 3 : 4;
    const sizeLen = major === 2 ? 3 : (major >= 4 ? 4 : 4);
    let p = 0;
    while (p + idLen + sizeLen <= body.length) {
      const id = body.toString('ascii', p, p + idLen);
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      let size = 0;
      if (major === 2) {
        size = (body[p + 3] << 16) | (body[p + 4] << 8) | body[p + 5];
      } else if (major >= 4) {
        size = syncsafe(body, p + idLen);
      } else {
        size = body.readUInt32BE(p + idLen);
      }
      const dataStart = p + idLen + sizeLen + (major === 2 ? 0 : 2);
      if (size <= 0 || dataStart + size > body.length) break;
      const data = body.slice(dataStart, dataStart + size);

      if (id === 'TIT2' || id === 'TT2') out.title = decodeText(data.slice(1), data[0]);
      else if (id === 'TPE1' || id === 'TP1') out.artist = decodeText(data.slice(1), data[0]);
      else if (id === 'TALB' || id === 'TAL') out.album = decodeText(data.slice(1), data[0]);
      else if (id === 'APIC' || id === 'PIC') {
        const enc = data[0];
        let q = 1;
        let mime = 'image/jpeg';
        if (id === 'PIC') {
          mime = 'image/' + data.toString('ascii', 1, 4).toLowerCase().replace('jpg', 'jpeg');
          q = 4;
        } else {
          let z = data.indexOf(0, 1);
          if (z < 0) z = 1;
          mime = data.toString('latin1', 1, z) || 'image/jpeg';
          q = z + 1;
        }
        q += 1; // picture type
        // description：按编码决定终止符宽度
        if (enc === 1 || enc === 2) {
          while (q + 1 < data.length && !(data[q] === 0 && data[q + 1] === 0)) q += 2;
          q += 2;
        } else {
          while (q < data.length && data[q] !== 0) q += 1;
          q += 1;
        }
        const img = data.slice(q);
        if (img.length > 64) out.picture = { mime, data: img };
      }
      p = dataStart + size;
    }
    return out;
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {}
  }
}

function humanize(name) {
  return name
    .replace(/[-_.]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^./, function (c) { return c.toUpperCase(); });
}

function findSidecar(baseAbs) {
  for (const ext of SIDECAR) if (fs.existsSync(baseAbs + ext)) return baseAbs + ext;
  return null;
}

/* 封面不写进 source/：before_generate 里新落盘的文件不会被本次扫描收进 public。
   改为把图片字节交给 generator 出路由，一次构建内即时可见。 */
function saveCover(buf, mime, collected) {
  let ext = (mime || 'image/jpeg').split('/')[1] || 'jpg';
  ext = ext.replace('jpeg', 'jpg').replace('x-png', 'png');
  ext = ext.split('+')[0];
  if (!IMG_EXT.has(ext)) ext = 'jpg';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const name = hash + '.' + ext;
  collected.push({ path: 'img/covers/' + name, data: buf });
  return '/img/covers/' + name;
}

hexo.extend.generator.register('music_playlist', function () {
  const root = hexo.base_dir;
  const dir = path.join(root, AUDIO_DIR);
  const routes = [];
  if (!fs.existsSync(dir)) {
    hexo.log.info('[music] 没有 ' + AUDIO_DIR + '/，跳过曲库构建');
    return routes;
  }
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp3') && !f.startsWith('.')).sort();
  const tracks = [];

  for (const file of files) {
    const abs = path.join(dir, file);
    const base = path.basename(file, path.extname(file));
    const id3 = readId3(abs) || { title: '', artist: '', album: '', picture: null };

    let cover = null;
    let coverSource = 'none';
    if (id3.picture) {
      cover = saveCover(id3.picture.data, id3.picture.mime, routes);
      coverSource = 'id3';
    } else {
      const side = findSidecar(abs.slice(0, -4));
      if (side) {
        cover = saveCover(fs.readFileSync(side), 'image/' + path.extname(side).slice(1), routes);
        coverSource = 'sidecar';
      }
    }

    tracks.push({
      src: '/audio/' + encodeURIComponent(file),
      title: id3.title || humanize(base),
      artist: id3.artist || '未知艺术家',
      album: id3.album || '',
      cover,
      coverSource
    });
  }

  routes.push({
    path: 'audio/playlist.json',
    data: JSON.stringify({ generatedAt: new Date().toISOString(), tracks }, null, 2) + '\n'
  });
  hexo.log.info('[music] ' + tracks.length + ' 首入库（封面 ' + tracks.filter((t) => t.cover).length +
    '，其中 ID3 内嵌 ' + tracks.filter((t) => t.coverSource === 'id3').length + '）');
  return routes;
});
