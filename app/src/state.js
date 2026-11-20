// VICEFRAME — project state, grading presets and typography styles.
// Everything the editor can change lives in one plain object so undo/redo is a
// JSON snapshot and the renderer is a pure function of (canvas, size, state).

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

export const LAYOUTS = [
  { id: 'hero', name: 'Cinematic Hero', blurb: 'One photo, giant type' },
  { id: 'triptych', name: 'Vice Triptych', blurb: 'Three vertical panels' },
  { id: 'mosaic', name: 'Sunset Mosaic', blurb: 'Asymmetric multi-photo' },
  { id: 'split', name: 'Split Cinema', blurb: 'Hero + two supports' },
  { id: 'editorial', name: 'Editorial Collection', blurb: 'Magazine cover grid' },
];

// Manual grading values. exposure/contrast/saturation are multipliers around 1;
// temperature is -50 (cold) .. +50 (warm); highlights/shadows are multipliers;
// vignette/grain/halftone are 0..1 strengths. tintA/tintB are the preset's overlay
// gradient colours (top -> bottom) drawn over each panel.
export const GRADES = {
  'vice-sunset': {
    name: 'Vice Sunset', exposure: 1.06, contrast: 1.12, saturation: 1.35,
    temperature: 18, highlights: 0.92, shadows: 1.08, vignette: 0.35,
    grain: 0.12, halftone: 0.15, tintA: 'rgba(255,94,98,0.10)', tintB: 'rgba(190,30,120,0.38)',
  },
  'neon-after-dark': {
    name: 'Neon After Dark', exposure: 0.95, contrast: 1.25, saturation: 1.5,
    temperature: -8, highlights: 0.85, shadows: 1.25, vignette: 0.5,
    grain: 0.2, halftone: 0.25, tintA: 'rgba(120,60,255,0.16)', tintB: 'rgba(10,10,60,0.42)',
  },
  'miami-heat': {
    name: 'Miami Heat', exposure: 1.12, contrast: 1.08, saturation: 1.45,
    temperature: 25, highlights: 1.0, shadows: 1.0, vignette: 0.25,
    grain: 0.08, halftone: 0.1, tintA: 'rgba(255,150,80,0.12)', tintB: 'rgba(0,160,170,0.28)',
  },
  'golden-hour': {
    name: 'Golden Hour', exposure: 1.15, contrast: 1.05, saturation: 1.25,
    temperature: 30, highlights: 1.1, shadows: 0.95, vignette: 0.2,
    grain: 0.06, halftone: 0.05, tintA: 'rgba(255,200,90,0.14)', tintB: 'rgba(180,90,20,0.30)',
  },
  'tropical-noir': {
    name: 'Tropical Noir', exposure: 0.88, contrast: 1.35, saturation: 0.9,
    temperature: -5, highlights: 0.8, shadows: 1.35, vignette: 0.6,
    grain: 0.25, halftone: 0.3, tintA: 'rgba(20,60,50,0.18)', tintB: 'rgba(30,10,50,0.45)',
  },
  'electric-blue': {
    name: 'Electric Blue', exposure: 1.0, contrast: 1.2, saturation: 1.3,
    temperature: -25, highlights: 0.95, shadows: 1.15, vignette: 0.4,
    grain: 0.15, halftone: 0.2, tintA: 'rgba(40,120,255,0.14)', tintB: 'rgba(0,20,80,0.40)',
  },
};

// Typography styles: font, colour, stroke, glow and tracking for the main title.
export const TYPE_STYLES = {
  'vice-block': {
    name: 'Vice Block', font: 'Bebas Neue', weight: 400, color: '#ffffff',
    stroke: '#ff2e88', strokeWidth: 0.035, shadow: 'rgba(255,46,136,0.9)',
    shadowBlur: 0.10, spacing: 0.02, lineHeight: 0.92, upper: true,
  },
  'neon-strip': {
    name: 'Neon Strip', font: 'Bebas Neue', weight: 400, color: '#e8fbff',
    stroke: '#00e5ff', strokeWidth: 0.02, shadow: 'rgba(0,229,255,0.95)',
    shadowBlur: 0.16, spacing: 0.14, lineHeight: 1.0, upper: true,
  },
  'editorial': {
    name: 'Editorial', font: 'Oswald', weight: 600, color: '#fff8ec',
    stroke: '#1a0b2e', strokeWidth: 0.012, shadow: 'rgba(0,0,0,0.55)',
    shadowBlur: 0.05, spacing: 0.05, lineHeight: 1.05, upper: true,
  },
};

export function defaultState() {
  return {
    layout: 'hero',
    size: '1080x1080',
    grade: 'vice-sunset',
    gradeManual: { ...GRADES['vice-sunset'] },
    title: 'SUNSET HEIST',
    subtitle: 'VICE COAST',
    support: 'A LAMON BAY STORY — ISSUE 01',
    typeStyle: 'vice-block',
    type: { sizeScale: 1.0, spacing: null, color: null, align: 'center', titleY: null },
    elements: {
      sunDisc: true, palms: true, skyline: true, neon: true,
      filmFrame: false, numbering: true, location: true,
    },
    // One entry per panel of the current layout; photo = index into photos.
    panels: [{ photo: 0, zoom: 1, dx: 0, dy: 0, fx: 0.5, fy: 0.35 }],
    selectedPanel: 0,
    // Photos are { id, name, img } and are NOT part of undo snapshots.
    photos: [],
  };
}

// A snapshot holds everything except the photo images (kept by id).
export function snapshot(state) {
  const { photos, ...rest } = state;
  return JSON.stringify(rest);
}

export function restore(state, snap) {
  const data = JSON.parse(snap);
  const photos = state.photos;
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, data, { photos });
}
