const STORAGE_KEY = 'archiveItems';
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('emptyState');
const clearBtn = document.getElementById('clearBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');

function formatDate(ts) { try { return new Date(ts).toLocaleString() } catch (e) { return '' } }

function render(items) {
  listEl.innerHTML = '';
  if (!items || !items.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';
  for (const item of items) {
    const li = document.createElement('li'); li.className = 'item';
    const img = document.createElement('img'); img.className = 'thumb'; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.src = item.url;
    const meta = document.createElement('div'); meta.className = 'meta';
    const url = document.createElement('div'); url.className = 'url'; url.textContent = item.url;
    const row = document.createElement('div'); row.className = 'row';
    const openBtn = document.createElement('button'); openBtn.className = 'small'; openBtn.textContent = 'Open'; openBtn.title = 'Open image in a new tab';
    openBtn.addEventListener('click', () => chrome.tabs.create({ url: item.url }));
    const delBtn = document.createElement('button'); delBtn.className = 'small danger'; delBtn.textContent = 'Delete'; delBtn.title = 'Remove this image';
    delBtn.addEventListener('click', async () => { const { [STORAGE_KEY]: existing = [] } = await chrome.storage.local.get(STORAGE_KEY); const next = existing.filter(x => x.url !== item.url); await chrome.storage.local.set({ [STORAGE_KEY]: next }); load(); });
    const when = document.createElement('span'); when.className = 'badge'; when.textContent = formatDate(item.addedAt);
    row.appendChild(openBtn); row.appendChild(delBtn); row.appendChild(when);
    meta.appendChild(url); meta.appendChild(row);
    li.appendChild(img); li.appendChild(meta); listEl.appendChild(li);
  }
}

async function load() {
  const { [STORAGE_KEY]: items = [] } = await chrome.storage.local.get(STORAGE_KEY);
  items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  render(items);
}

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all archived images?')) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  load();
});

downloadZipBtn.addEventListener('click', async () => {
  const { [STORAGE_KEY]: items = [] } = await chrome.storage.local.get(STORAGE_KEY);
  if (!items.length) { alert('Archive is empty.'); return; }
  try {
    const files = await fetchAllNormalized(items);
    const blob = createZipBlobStrict(files);
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: 'image-archive.zip', saveAs: true });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { console.error(e); alert('Failed to create ZIP.'); }
});

async function fetchAllNormalized(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const url = items[i].url;
    const resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    if (!resp.ok) throw new Error('Failed to fetch: ' + url);
    const type = resp.headers.get('content-type') || '';
    const ab = await resp.arrayBuffer();
    let bytes = new Uint8Array(ab);
    let ext = guessExtFromUrl(url) || guessExtFromType(type);
    if (ext === '.jpg' || ext === '.jpeg') { ext = '.jpg'; }
    else if (ext === '.png') { }
    else { bytes = await convertToPng(bytes, type); ext = '.png'; }
    const name = makeFileName(url, i, ext);
    out.push({ name, data: bytes });
  }
  return out;
}

function guessExtFromUrl(url) {
  try { const u = new URL(url); const last = (u.pathname.split('/').pop() || '').split('?')[0].split('#')[0]; const m = last.match(/\.(jpg|jpeg|png)$/i); return m ? ('.' + m[1].toLowerCase()) : null; } catch { return null; }
}
function guessExtFromType(t) { t = (t || '').toLowerCase(); if (t.includes('jpeg') || t.includes('jpg')) return '.jpg'; if (t.includes('png')) return '.png'; return null; }

async function convertToPng(bytes, type) {
  const blob = new Blob([bytes], { type: type || 'application/octet-stream' });
  if (typeof OffscreenCanvas !== 'undefined' && 'createImageBitmap' in window) {
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    const ab = await pngBlob.arrayBuffer(); return new Uint8Array(ab);
  }
  const url = URL.createObjectURL(blob);
  const img = await loadImage(url);
  const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
  const pngBlob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
  URL.revokeObjectURL(url);
  const ab = await pngBlob.arrayBuffer(); return new Uint8Array(ab);
}
function loadImage(url) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; }); }
function makeFileName(url, idx, ext) {
  let base = `image-${String(idx + 1).padStart(3, '0')}`;
  try { const u = new URL(url); const last = (u.pathname.split('/').pop() || '').split('?')[0].split('#')[0]; const stem = last.replace(/\.[a-z0-9]{2,6}$/i, ''); if (stem) base = `${String(idx + 1).padStart(3, '0')}-${sanitize(stem)}`; } catch { }
  if (ext === '.jpeg') ext = '.jpg';
  return base + (ext || '.png');
}
function sanitize(name) { return name.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'image'; }

/** Strict ZIP (STORE), tuned for macOS Finder */
function createZipBlobStrict(files) {
  const enc = new TextEncoder();
  const LFH = 0x04034b50, CDH = 0x02014b50, EOCD = 0x06054b50;
  const localChunks = []; const centralChunks = [];
  let offset = 0;
  const ts = dosTimeDate(new Date());

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const lfh = new DataView(new ArrayBuffer(30));
    let p = 0;
    lfh.setUint32(p, LFH, true); p += 4;
    lfh.setUint16(p, 20, true); p += 2;
    lfh.setUint16(p, 0x0800, true); p += 2;
    lfh.setUint16(p, 0, true); p += 2;
    lfh.setUint16(p, ts.time, true); p += 2;
    lfh.setUint16(p, ts.date, true); p += 2;
    lfh.setUint32(p, crc, true); p += 4;
    lfh.setUint32(p, size, true); p += 4;
    lfh.setUint32(p, size, true); p += 4;
    lfh.setUint16(p, nameBytes.length, true); p += 2;
    lfh.setUint16(p, 0, true); p += 2;
    localChunks.push(new Uint8Array(lfh.buffer), nameBytes, f.data);
    const localOffset = offset;
    offset += 30 + nameBytes.length + size;

    // Central Directory
    const cdh = new DataView(new ArrayBuffer(46));
    p = 0;
    cdh.setUint32(p, CDH, true); p += 4;
    cdh.setUint16(p, 0x0314, true); p += 2;
    cdh.setUint16(p, 20, true); p += 2;
    cdh.setUint16(p, 0x0800, true); p += 2;
    cdh.setUint16(p, 0, true); p += 2;
    cdh.setUint16(p, ts.time, true); p += 2;
    cdh.setUint16(p, ts.date, true); p += 2;
    cdh.setUint32(p, crc, true); p += 4;
    cdh.setUint32(p, size, true); p += 4;
    cdh.setUint32(p, size, true); p += 4;
    cdh.setUint16(p, nameBytes.length, true); p += 2;
    cdh.setUint16(p, 0, true); p += 2;
    cdh.setUint16(p, 0, true); p += 2;
    cdh.setUint16(p, 0, true); p += 2;
    cdh.setUint16(p, 0, true); p += 2;
    cdh.setUint32(p, 0o100644 << 16, true); p += 4;
    cdh.setUint32(p, localOffset, true); p += 4;
    centralChunks.push(new Uint8Array(cdh.buffer), nameBytes);
  }

  const centralStart = offset;
  const centralBytes = concat(centralChunks);
  offset += centralBytes.length;
  const centralSize = centralBytes.length;

  const eocd = new DataView(new ArrayBuffer(22));
  let q = 0;
  eocd.setUint32(q, EOCD, true); q += 4;
  eocd.setUint16(q, 0, true); q += 2;
  eocd.setUint16(q, 0, true); q += 2;
  eocd.setUint16(q, files.length, true); q += 2;
  eocd.setUint16(q, files.length, true); q += 2;
  eocd.setUint32(q, centralSize, true); q += 4;
  eocd.setUint32(q, centralStart, true); q += 4;
  eocd.setUint16(q, 0, true); q += 2;

  const all = concat([...localChunks, centralBytes, new Uint8Array(eocd.buffer)]);
  return new Blob([all], { type: 'application/zip' });
}

function concat(arrs) {
  let total = 0; for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

function dosTimeDate(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(data) { let c = 0 ^ (-1); for (let i = 0; i < data.length; i++) { c = (c >>> 8) ^ CRC_TABLE[(c ^ data[i]) & 0xFF]; } return (c ^ (-1)) >>> 0; }

load();
