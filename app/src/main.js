// VICEFRAME — wires the editor: photos, layouts, grading, typography, graphic
// elements, panel editing, undo/redo and the PNG export engine. The preview and
// the export both call renderCover, so the file always matches the screen.
import { defaultState, SIZES, LAYOUTS, GRADES, TYPE_STYLES, tagForPhoto, snapshot, restore } from './state.js';
import { getLayout, panelCount } from './layouts.js';
import { renderCover, fontsReady } from './render.js';
import { runShot } from './shots.js';

const state = defaultState();
let undoStack = [];
let redoStack = [];
let focalMode = false;
let nextPhotoId = 1;

const $ = (id) => document.getElementById(id);
const preview = $('preview');

// ---------- undo / redo ----------
function pushUndo() {
  undoStack.push(snapshot(state));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}
function syncUndoButtons() {
  $('btnUndo').disabled = undoStack.length === 0;
  $('btnRedo').disabled = redoStack.length === 0;
}
function doUndo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot(state));
  restore(state, undoStack.pop());
  syncAll(); syncUndoButtons();
}
function doRedo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot(state));
  restore(state, redoStack.pop());
  syncAll(); syncUndoButtons();
}

// ---------- photos ----------
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function addPhotoFile(file) {
  if (state.photos.length >= 6) { setStatus('Photo library is full (6).'); return; }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    state.photos.push({ id: nextPhotoId++, name: file.name, img, src: url });
    pushUndo();
    syncLibrary(); syncPanelPhotoSelect(); render();
  } catch (e) { setStatus('Could not read that image.'); }
}

async function loadSamples() {
  for (const [name, src] of [['pier.jpg', 'samples/pier.jpg'], ['boulevard.jpg', 'samples/boulevard.jpg'], ['neon.jpg', 'samples/neon.jpg']]) {
    try {
      const img = await loadImage(src);
      state.photos.push({ id: nextPhotoId++, name, img, src });
    } catch (e) { /* samples are optional */ }
  }
  syncLibrary(); syncPanelPhotoSelect(); render();
}

function photoById(id) { return state.photos.find((p) => p.id === id); }

// ---------- rendering ----------
let renderToken = 0;
async function render() {
  const token = ++renderToken;
  await fontsReady();
  if (token !== renderToken) return;
  const size = SIZES[state.size];
  // Keep the preview (plus its hint and meta line) inside the centre column,
  // sized to the real viewport: at 720p the column is ~460px tall, at 1080p
  // it is ~820px, so the preview stays sharp on a desktop.
  const availH = Math.max(320, (window.innerHeight || 720) - 260);
  const scale = Math.min(760 / size.w, availH / size.h);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  const off = document.createElement('canvas');
  off.width = size.w; off.height = size.h;
  await renderCover(off, state, { highlightPanel: state.selectedPanel });
  const pctx = preview.getContext('2d');
  pctx.clearRect(0, 0, preview.width, preview.height);
  pctx.drawImage(off, 0, 0, preview.width, preview.height);
  $('sizeLabel').textContent = `${size.w} x ${size.h}`;
  $('bottomSize').textContent = `${size.w} x ${size.h}`;
  $('layoutLabel').textContent = LAYOUTS.find((l) => l.id === state.layout).name;
  syncPanelThumbs();
}

function setStatus(msg) { $('exportStatus').textContent = msg; }

// ---------- layout / size ----------
function syncLayoutList() {
  const list = $('layoutList');
  list.innerHTML = '';
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layout-btn' + (state.layout === l.id ? ' active' : '');
    b.innerHTML = `<strong>${l.name}</strong><span>${l.blurb}</span>`;
    b.addEventListener('click', () => {
      pushUndo();
      state.layout = l.id;
      fitPanelsToLayout();
      syncAll();
    });
    list.appendChild(b);
  }
}

function fitPanelsToLayout() {
  const n = panelCount(state.layout);
  const old = state.panels;
  state.panels = [];
  for (let i = 0; i < n; i++) {
    const prev = old[i] || old[0] || { photo: 0, zoom: 1, dx: 0, dy: 0, fx: 0.5, fy: 0.35 };
    state.panels.push({ ...prev });
  }
  state.selectedPanel = Math.min(state.selectedPanel, n - 1);
}

function syncSizeRadios() {
  const box = $('sizeRadios');
  box.innerHTML = '';
  for (const [id, s] of Object.entries(SIZES)) {
    const label = document.createElement('label');
    label.className = 'radio';
    label.innerHTML = `<input type="radio" name="exsize" value="${id}" ${state.size === id ? 'checked' : ''}> ${s.label}`;
    label.querySelector('input').addEventListener('change', () => {
      pushUndo();
      state.size = id;
      render();
    });
    box.appendChild(label);
  }
}

// ---------- grading ----------
const SLIDERS = [
  ['exposure', 'Exposure', 0.5, 1.6, 0.01],
  ['contrast', 'Contrast', 0.5, 2, 0.01],
  ['saturation', 'Saturation', 0, 2, 0.01],
  ['temperature', 'Temperature', -50, 50, 1],
  ['highlights', 'Highlights', 0.5, 1.5, 0.01],
  ['shadows', 'Shadows', 0.5, 1.6, 0.01],
  ['vignette', 'Vignette', 0, 1, 0.01],
  ['grain', 'Film grain', 0, 1, 0.01],
  ['halftone', 'Halftone', 0, 1, 0.01],
];

function syncGradePresets() {
  const box = $('gradePresets');
  box.innerHTML = '';
  for (const [id, g] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset-btn' + (state.grade === id ? ' active' : '');
    b.style.background = `linear-gradient(135deg, ${g.tintA.replace(/[\d.]+\)$/, '0.85)')}, ${g.tintB.replace(/[\d.]+\)$/, '0.9)')})`;
    b.textContent = g.name;
    b.addEventListener('click', () => {
      pushUndo();
      state.grade = id;
      state.gradeManual = { ...GRADES[id] };
      syncGradeSliders(); syncGradePresets(); render();
    });
    box.appendChild(b);
  }
}

function syncGradeSliders() {
  const box = $('gradeSliders');
  box.innerHTML = '';
  for (const [key, label, min, max, step] of SLIDERS) {
    const wrap = document.createElement('label');
    wrap.className = 'slider-row';
    wrap.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${state.gradeManual[key]}"><b>${fmtVal(key, state.gradeManual[key])}</b>`;
    const input = wrap.querySelector('input');
    input.addEventListener('input', () => {
      state.gradeManual[key] = Number(input.value);
      wrap.querySelector('b').textContent = fmtVal(key, state.gradeManual[key]);
      render();
    });
    input.addEventListener('change', pushUndo);
    box.appendChild(wrap);
  }
}

function fmtVal(key, v) {
  if (key === 'temperature') return `${v > 0 ? '+' : ''}${v}`;
  return Number(v).toFixed(2);
}

// ---------- typography ----------
function syncTypeUI() {
  const sel = $('typeStyle');
  sel.innerHTML = '';
  for (const [id, s] of Object.entries(TYPE_STYLES)) {
    const o = document.createElement('option');
    o.value = id; o.textContent = s.name;
    sel.appendChild(o);
  }
  sel.value = state.typeStyle;
  $('inTitle').value = state.title;
  $('inSubtitle').value = state.subtitle;
  $('inSupport').value = state.support;
  $('typeSize').value = state.type.sizeScale;
  $('typeAlign').value = state.type.align || 'center';
  $('typeColor').value = state.type.color || '#ffffff';
}

function wireTypeUI() {
  $('typeStyle').addEventListener('change', (e) => { pushUndo(); state.typeStyle = e.target.value; render(); });
  $('inTitle').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('inTitle').addEventListener('change', pushUndo);
  $('inSubtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('inSubtitle').addEventListener('change', pushUndo);
  $('inSupport').addEventListener('input', (e) => { state.support = e.target.value; render(); });
  $('inSupport').addEventListener('change', pushUndo);
  $('typeSize').addEventListener('input', (e) => { state.type.sizeScale = Number(e.target.value); render(); });
  $('typeSize').addEventListener('change', pushUndo);
  $('typeAlign').addEventListener('change', (e) => { pushUndo(); state.type.align = e.target.value; render(); });
  $('typeColor').addEventListener('input', (e) => { state.type.color = e.target.value; render(); });
  $('typeColor').addEventListener('change', pushUndo);
}

// ---------- graphic elements ----------
const ELEMENT_LABELS = {
  sunDisc: 'Sunset disc', palms: 'Palm silhouettes', skyline: 'Coastal skyline',
  neon: 'Neon accents', filmFrame: 'Film-frame border', numbering: 'Issue numbering',
  location: 'Location label', castTags: 'Cast role tags', billing: 'Billing block',
  popout: 'Pop-out hero', seal: 'Seal / stamp', slant: 'Slanted panels',
};

// When a panel gets a new photo, its cast tag follows the photo's role.
function assignPanelPhoto(idx, photoIdx) {
  state.panels[idx].photo = photoIdx;
  const name = state.photos[photoIdx]?.name || '';
  state.panels[idx].tag = tagForPhoto(name);
}

function syncElementToggles() {
  const box = $('elementToggles');
  box.innerHTML = '';
  for (const [key, label] of Object.entries(ELEMENT_LABELS)) {
    const l = document.createElement('label');
    l.className = 'check';
    l.innerHTML = `<input type="checkbox" ${state.elements[key] ? 'checked' : ''}> ${label}`;
    l.querySelector('input').addEventListener('change', (e) => {
      pushUndo();
      state.elements[key] = e.target.checked;
      render();
    });
    box.appendChild(l);
  }
}

// ---------- library / panel ----------
function syncLibrary() {
  const lib = $('library');
  lib.innerHTML = '';
  state.photos.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'thumb' + (state.panels[state.selectedPanel]?.photo === i ? ' active' : '');
    d.innerHTML = `<img src="${p.src}" alt="${p.name}"><span>${p.name}</span>`;
    d.addEventListener('click', () => {
      pushUndo();
      assignPanelPhoto(state.selectedPanel, i);
      syncLibrary(); syncPanelPhotoSelect(); syncPanelThumbs(); render();
    });
    lib.appendChild(d);
  });
  $('selPhoto').textContent = `Photo: ${state.photos[state.panels[state.selectedPanel]?.photo]?.name || '—'}`;
}

function syncPanelPhotoSelect() {
  const sel = $('panelPhoto');
  sel.innerHTML = '';
  state.photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = p.name;
    sel.appendChild(o);
  });
  sel.value = String(state.panels[state.selectedPanel]?.photo ?? 0);
  const panel = state.panels[state.selectedPanel];
  if (panel) $('panelZoom').value = panel.zoom;
}

function syncLayers() {
  const ul = $('layerList');
  ul.innerHTML = '';
  const layout = getLayout(state.layout, 1080, 1080);
  layout.panels.forEach((_, i) => {
    const li = document.createElement('li');
    li.className = state.selectedPanel === i ? 'active' : '';
    const name = state.photos[state.panels[i]?.photo]?.name || 'Empty';
    li.textContent = `Panel ${i + 1} — ${name}`;
    li.addEventListener('click', () => { state.selectedPanel = i; syncAll(); });
    ul.appendChild(li);
  });
  for (const [key, label] of Object.entries(ELEMENT_LABELS)) {
    if (!state.elements[key]) continue;
    const li = document.createElement('li');
    li.textContent = `✦ ${label}`;
    ul.appendChild(li);
  }
  const li = document.createElement('li');
  li.textContent = 'T Title / subtitle / support';
  ul.appendChild(li);
}

async function syncPanelThumbs() {
  const box = $('panelThumbs');
  box.innerHTML = '';
  const layout = getLayout(state.layout, SIZES[state.size].w, SIZES[state.size].h);
  const off = document.createElement('canvas');
  off.width = SIZES[state.size].w; off.height = SIZES[state.size].h;
  await renderCover(off, state, {});
  layout.panels.forEach((p, i) => {
    const c = document.createElement('canvas');
    c.width = 120; c.height = Math.round(120 * (p.h / p.w));
    const ctx = c.getContext('2d');
    ctx.drawImage(off, p.x * off.width, p.y * off.height, p.w * off.width, p.h * off.height, 0, 0, c.width, c.height);
    c.className = 'panel-thumb' + (state.selectedPanel === i ? ' active' : '');
    c.addEventListener('click', () => { state.selectedPanel = i; syncAll(); });
    box.appendChild(c);
  });
}

function syncAll() {
  syncLayoutList(); syncSizeRadios(); syncGradePresets(); syncGradeSliders();
  syncTypeUI(); syncElementToggles(); syncLibrary(); syncPanelPhotoSelect(); syncLayers();
  render();
}

// ---------- export engine ----------
// Re-renders the cover at full export resolution (never a screenshot of the
// preview) and downloads the PNG the app wrote.
async function exportSize(sizeId) {
  const size = SIZES[sizeId];
  setStatus(`Rendering ${size.w} x ${size.h}…`);
  const off = document.createElement('canvas');
  off.width = size.w; off.height = size.h;
  await renderCover(off, state, {});
  const blob = await new Promise((res) => off.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `viceframe-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(`Saved viceframe-${size.w}x${size.h}.png (${(blob.size / 1024).toFixed(0)} KiB).`);
  return blob;
}

async function exportAll() {
  for (const id of Object.keys(SIZES)) {
    await exportSize(id);
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ---------- preview interaction ----------
function previewPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width,
    y: (e.clientY - r.top) / r.height,
  };
}

function panelAt(x, y) {
  const size = SIZES[state.size];
  const layout = getLayout(state.layout, size.w, size.h);
  return layout.panels.findIndex((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

let drag = null;
preview.addEventListener('pointerdown', (e) => {
  const pt = previewPoint(e);
  const idx = panelAt(pt.x, pt.y);
  if (idx < 0) return;
  state.selectedPanel = idx;
  syncLibrary(); syncPanelPhotoSelect(); syncLayers(); syncPanelThumbs();
  const panel = state.panels[idx];
  if (focalMode) {
    pushUndo();
    const size = SIZES[state.size];
    const layout = getLayout(state.layout, size.w, size.h);
    const p = layout.panels[idx];
    const photo = state.photos[panel.photo] || state.photos[0];
    // Convert the clicked point (panel fractions) into photo fractions via
    // the window the panel currently shows, then centre on it.
    const px = (pt.x - p.x) / p.w;
    const py = (pt.y - p.y) / p.h;
    if (photo && photo.img) {
      const iw = photo.img.naturalWidth; const ih = photo.img.naturalHeight;
      const rectW = p.w * size.w; const rectH = p.h * size.h;
      const base = Math.max(rectW / iw, rectH / ih);
      const scale = base * (panel.zoom || 1);
      const vw = rectW / scale; const vh = rectH / scale;
      let cx = (panel.fx ?? 0.5) * iw + (panel.dx || 0) * vw * 0.5;
      let cy = (panel.fy ?? 0.5) * ih + (panel.dy || 0) * vh * 0.5;
      cx = Math.min(Math.max(cx, vw / 2), iw - vw / 2);
      cy = Math.min(Math.max(cy, vh / 2), ih - vh / 2);
      const sx = Math.max(0, cx - vw / 2);
      const sy = Math.max(0, cy - vh / 2);
      panel.fx = Math.min(1, Math.max(0, (sx + px * vw) / iw));
      panel.fy = Math.min(1, Math.max(0, (sy + py * vh) / ih));
      panel.dx = 0; panel.dy = 0;
    }
    focalMode = false;
    $('btnFocal').setAttribute('aria-pressed', 'false');
    $('btnFocal').textContent = 'Set focal point';
    render();
    return;
  }
  drag = { x: pt.x, y: pt.y, panel, moved: false };
  preview.setPointerCapture(e.pointerId);
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = previewPoint(e);
  const size = SIZES[state.size];
  const layout = getLayout(state.layout, size.w, size.h);
  const p = layout.panels[state.selectedPanel];
  const dx = (pt.x - drag.x) / p.w;
  const dy = (pt.y - drag.y) / p.h;
  if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) drag.moved = true;
  drag.panel.dx = Math.max(-1.5, Math.min(1.5, (drag.panel.dx || 0) - dx * 2));
  drag.panel.dy = Math.max(-1.5, Math.min(1.5, (drag.panel.dy || 0) - dy * 2));
  drag.x = pt.x; drag.y = pt.y;
  render();
});
preview.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushUndo();
  drag = null;
});
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) * (e.deltaY < 0 ? 1.1 : 0.9)));
  $('panelZoom').value = panel.zoom;
  render();
}, { passive: false });

// ---------- top bar / panel controls / upload ----------
function wireChrome() {
  $('btnUndo').addEventListener('click', doUndo);
  $('btnRedo').addEventListener('click', doRedo);
  $('btnReset').addEventListener('click', () => {
    pushUndo();
    const keep = state.photos;
    const fresh = defaultState();
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh, { photos: keep });
    syncAll();
  });
  $('btnNew').addEventListener('click', () => {
    pushUndo();
    const fresh = defaultState();
    fresh.photos = state.photos;
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, fresh);
    syncAll();
  });
  $('btnExportTop').addEventListener('click', () => exportSize(state.size));
  $('btnExport').addEventListener('click', () => exportSize(state.size));
  $('btnExportAll').addEventListener('click', exportAll);
  $('panelPhoto').addEventListener('change', (e) => {
    pushUndo();
    assignPanelPhoto(state.selectedPanel, Number(e.target.value));
    syncLibrary(); syncPanelThumbs(); render();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].zoom = Number(e.target.value);
    render();
  });
  $('panelZoom').addEventListener('change', pushUndo);
  $('btnFit').addEventListener('click', () => {
    pushUndo();
    const p = state.panels[state.selectedPanel];
    p.zoom = 1; p.dx = 0; p.dy = 0; p.fx = 0.5; p.fy = 0.35;
    $('panelZoom').value = 1;
    render();
  });
  $('btnFocal').addEventListener('click', () => {
    focalMode = !focalMode;
    $('btnFocal').setAttribute('aria-pressed', String(focalMode));
    $('btnFocal').textContent = focalMode ? 'Click the photo…' : 'Set focal point';
  });
  $('fileInput').addEventListener('change', async (e) => {
    for (const f of e.target.files) await addPhotoFile(f);
    e.target.value = '';
  });
  const dz = $('dropzone');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', async (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    for (const f of e.dataTransfer.files) {
      if (f.type.startsWith('image/')) await addPhotoFile(f);
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); }
  });
}

// ---------- shots & init ----------
const shot = new URLSearchParams(location.search).get('shot');
(async () => {
  wireChrome();
  wireTypeUI();
  syncAll();
  await loadSamples();
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), state, render);
    if (shot === 'cover') {
      // The cover scene is already painted full-size by runShot: sync the
      // (hidden) UI state but do NOT call render(), which would shrink the
      // preview canvas back to editor size.
      syncLayoutList(); syncSizeRadios(); syncGradePresets(); syncGradeSliders();
      syncTypeUI(); syncElementToggles(); syncLibrary(); syncPanelPhotoSelect(); syncLayers();
    } else {
      syncAll();
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__shotReady = true;
  }
})();
