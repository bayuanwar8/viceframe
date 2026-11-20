// VICEFRAME — fixed scenes for screenshots: ?shot=cover shows the cover alone
// at export size; ?shot=editor shows the full editor with a sample photo.
// Query params: layout, grade, size, photo, caption, subtitle.
// window.__shotReady is set once the scene is painted.
import { GRADES, SIZES } from './state.js';
import { panelCount } from './layouts.js';
import { renderCover, fontsReady } from './render.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function applyQuery(state, query) {
  const layout = query.get('layout');
  if (layout && ['hero', 'triptych', 'mosaic', 'split', 'editorial'].includes(layout)) {
    state.layout = layout;
  }
  const grade = query.get('grade');
  if (grade && GRADES[grade]) {
    state.grade = grade;
    state.gradeManual = { ...GRADES[grade] };
  }
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const caption = query.get('caption');
  if (caption) state.title = caption;
  const subtitle = query.get('subtitle');
  if (subtitle) state.subtitle = subtitle;
  // Per-panel photos: photos=pier,boulevard,pier (cycles if fewer than panels).
  const photos = query.get('photos');
  state._shotPhotos = photos ? photos.split(',').map((s) => s.trim()).filter(Boolean) : null;
  // Per-panel focal points: focal=0.5,0.28;0.5,0.3 (x,y per panel, cycles).
  const focal = query.get('focal');
  state._shotFocal = focal ? focal.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { fx: x, fy: y };
  }) : null;
  const n = panelCount(state.layout);
  const old = state.panels;
  state.panels = [];
  for (let i = 0; i < n; i++) {
    const prev = old[i] || old[0] || { photo: 0, zoom: 1, dx: 0, dy: 0, fx: 0.5, fy: 0.35 };
    state.panels.push({ ...prev });
  }
  state.selectedPanel = 0;
}

export async function runShot(shot, query, state, render) {
  applyQuery(state, query);
  const photoName = query.get('photo') ?? 'pier';
  const names = state._shotPhotos || [photoName];
  for (let i = 0; i < state.panels.length; i++) {
    const name = names[i % names.length];
    let idx = state.photos.findIndex((p) => p.name === `${name}.jpg`);
    if (idx < 0) {
      try {
        const img = await loadImage(`samples/${name}.jpg`);
        state.photos.push({ id: 900 + state.photos.length, name: `${name}.jpg`, img, src: `samples/${name}.jpg` });
        idx = state.photos.length - 1;
      } catch (e) { idx = 0; }
    }
    state.panels[i].photo = idx;
    if (state._shotFocal) {
      const f = state._shotFocal[i % state._shotFocal.length];
      if (f && Number.isFinite(f.fx) && Number.isFinite(f.fy)) {
        state.panels[i].fx = f.fx;
        state.panels[i].fy = f.fy;
      }
    }
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = SIZES[state.size];
    const canvas = document.getElementById('preview');
    canvas.width = size.w;
    canvas.height = size.h;
    await fontsReady();
    await renderCover(canvas, state, {});
  } else {
    // Editor scene: full UI, sample photo loaded, state applied.
    await render();
    await fontsReady();
  }
}
