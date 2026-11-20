// VICEFRAME — the five original layouts. Each layout is a function of the canvas
// size that returns panel rectangles (fractions of W/H) plus text zones. Layouts
// are tuned per aspect class (square 1:1, portrait 4:5, wide 16:9) because the
// same fractions do not preserve a composition across ratios.

function aspectOf(w, h) {
  const r = w / h;
  if (r > 1.25) return 'wide';
  if (r < 0.9) return 'portrait';
  return 'square';
}

const GAP = 0.012; // panel gap, as a fraction of the shorter side

function hero(w, h) {
  const a = aspectOf(w, h);
  const text = {
    title: { x: 0.06, y: 0.70, w: 0.88, align: 'left' },
    subtitle: { x: 0.06, y: 0.655, w: 0.88, align: 'left' },
    support: { x: 0.06, y: 0.955, w: 0.88, align: 'left' },
    location: { x: 0.06, y: 0.045, w: 0.5, align: 'left' },
  };
  if (a === 'wide') {
    text.title = { x: 0.05, y: 0.60, w: 0.62, align: 'left' };
    text.subtitle = { x: 0.05, y: 0.545, w: 0.62, align: 'left' };
    text.support = { x: 0.05, y: 0.93, w: 0.62, align: 'left' };
  }
  return {
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
    text,
    sun: { x: 0.16, y: 0.13, r: 0.11 },
    skylineY: 0.60,
  };
}

function triptych(w, h) {
  const a = aspectOf(w, h);
  const g = GAP;
  const pw = (1 - 2 * g) / 3;
  const panels = [0, 1, 2].map((i) => ({
    x: i * (pw + g), y: a === 'wide' ? 0.06 : 0, w: pw, h: a === 'wide' ? 0.72 : 0.78,
  }));
  const text = {
    title: { x: 0.04, y: 0.815, w: 0.92, align: 'center' },
    subtitle: { x: 0.04, y: 0.785, w: 0.92, align: 'center' },
    support: { x: 0.04, y: 0.955, w: 0.92, align: 'center' },
    location: { x: 0.04, y: 0.02, w: 0.5, align: 'left' },
  };
  if (a === 'wide') {
    text.title.y = 0.815; text.subtitle.y = 0.785;
  }
  return { panels, text, sun: { x: 0.08, y: 0.06, r: 0.045 }, skylineY: 0.66 };
}

function mosaic(w, h) {
  const a = aspectOf(w, h);
  const g = GAP;
  let panels;
  if (a === 'portrait') {
    panels = [
      { x: 0, y: 0, w: 1, h: 0.44 },
      { x: 0, y: 0.45, w: 0.495, h: 0.27 },
      { x: 0.505, y: 0.45, w: 0.495, h: 0.27 },
      { x: 0, y: 0.73, w: 1, h: 0.27 },
    ];
  } else if (a === 'wide') {
    panels = [
      { x: 0, y: 0, w: 0.44, h: 1 },
      { x: 0.45, y: 0, w: 0.265, h: 0.485 },
      { x: 0.725, y: 0, w: 0.275, h: 0.485 },
      { x: 0.45, y: 0.5, w: 0.55, h: 0.5 },
    ];
  } else {
    panels = [
      { x: 0, y: 0, w: 0.60, h: 0.60 },
      { x: 0.61, y: 0, w: 0.39, h: 0.295 },
      { x: 0.61, y: 0.305, w: 0.39, h: 0.295 },
      { x: 0, y: 0.61, w: 1, h: 0.39 },
    ];
  }
  const text = {
    title: { x: 0.04, y: 0.845, w: 0.92, align: 'left' },
    subtitle: { x: 0.04, y: 0.805, w: 0.92, align: 'left' },
    support: { x: 0.04, y: 0.965, w: 0.92, align: 'left' },
    location: { x: 0.63, y: 0.03, w: 0.33, align: 'right' },
  };
  if (a === 'wide') {
    text.title = { x: 0.47, y: 0.80, w: 0.50, align: 'left' };
    text.subtitle = { x: 0.47, y: 0.755, w: 0.50, align: 'left' };
    text.support = { x: 0.47, y: 0.94, w: 0.50, align: 'left' };
    text.location = { x: 0.47, y: 0.03, w: 0.50, align: 'left' };
  }
  if (a === 'portrait') {
    // Text block sits low in the bottom band with the subtitle BELOW the
    // title: the old subtitle at y 0.82 crossed any face in the bottom
    // panel, and a face in that panel's upper half now clears the type.
    text.title = { x: 0.04, y: 0.845, w: 0.92, align: 'left' };
    text.subtitle = { x: 0.04, y: 0.95, w: 0.92, align: 'left' };
    text.support = { x: 0.04, y: 0.972, w: 0.92, align: 'left' };
  }
  return { panels, text, sun: { x: 0.10, y: 0.06, r: 0.05 }, skylineY: 0.55 };
}

function split(w, h) {
  const a = aspectOf(w, h);
  let panels;
  if (a === 'wide') {
    panels = [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.63, y: 0, w: 0.37, h: 0.49 },
      { x: 0.63, y: 0.50, w: 0.37, h: 0.50 },
    ];
  } else if (a === 'portrait') {
    panels = [
      { x: 0, y: 0, w: 1, h: 0.54 },
      { x: 0, y: 0.55, w: 0.495, h: 0.45 },
      { x: 0.505, y: 0.55, w: 0.495, h: 0.45 },
    ];
  } else {
    panels = [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.63, w: 0.495, h: 0.37 },
      { x: 0.505, y: 0.63, w: 0.495, h: 0.37 },
    ];
  }
  const text = {
    title: { x: 0.05, y: 0.475, w: 0.90, align: 'left' },
    subtitle: { x: 0.05, y: 0.43, w: 0.90, align: 'left' },
    support: { x: 0.05, y: 0.965, w: 0.90, align: 'left' },
    location: { x: 0.05, y: 0.03, w: 0.5, align: 'left' },
  };
  if (a === 'wide') {
    text.title = { x: 0.65, y: 0.80, w: 0.32, align: 'left' };
    text.subtitle = { x: 0.65, y: 0.755, w: 0.32, align: 'left' };
    text.support = { x: 0.03, y: 0.955, w: 0.55, align: 'left' };
    text.location = { x: 0.65, y: 0.03, w: 0.32, align: 'left' };
  }
  if (a === 'portrait') {
    text.title = { x: 0.05, y: 0.40, w: 0.90, align: 'left' };
    text.subtitle = { x: 0.05, y: 0.355, w: 0.90, align: 'left' };
  }
  return { panels, text, sun: { x: 0.85, y: 0.10, r: 0.06 }, skylineY: 0.45 };
}

function editorial(w, h) {
  const a = aspectOf(w, h);
  let panels;
  if (a === 'wide') {
    panels = [
      { x: 0, y: 0.13, w: 0.50, h: 0.87 },
      { x: 0.51, y: 0.13, w: 0.49, h: 0.28 },
      { x: 0.51, y: 0.42, w: 0.49, h: 0.28 },
      { x: 0.51, y: 0.71, w: 0.49, h: 0.29 },
    ];
  } else if (a === 'portrait') {
    panels = [
      { x: 0, y: 0.12, w: 1, h: 0.50 },
      { x: 0, y: 0.63, w: 0.325, h: 0.25 },
      { x: 0.34, y: 0.63, w: 0.325, h: 0.25 },
      { x: 0.675, y: 0.63, w: 0.325, h: 0.25 },
    ];
  } else {
    panels = [
      { x: 0, y: 0.13, w: 0.55, h: 0.87 },
      { x: 0.56, y: 0.13, w: 0.44, h: 0.28 },
      { x: 0.56, y: 0.42, w: 0.44, h: 0.28 },
      { x: 0.56, y: 0.71, w: 0.44, h: 0.29 },
    ];
  }
  const text = {
    title: { x: 0.04, y: 0.015, w: 0.92, align: 'left' },
    subtitle: { x: 0.56, y: 0.955, w: 0.40, align: 'left' },
    support: { x: 0.04, y: 0.955, w: 0.50, align: 'left' },
    location: { x: 0.60, y: 0.02, w: 0.36, align: 'right' },
  };
  if (a === 'portrait') {
    text.subtitle = { x: 0.04, y: 0.905, w: 0.92, align: 'left' };
    text.support = { x: 0.04, y: 0.965, w: 0.92, align: 'left' };
    text.location = { x: 0.60, y: 0.02, w: 0.36, align: 'right' };
  }
  return { panels, text, sun: { x: 0.10, y: 0.06, r: 0.045 }, skylineY: 0.60 };
}

export const LAYOUT_FNS = { hero, triptych, mosaic, split, editorial };

export function getLayout(id, w, h) {
  return LAYOUT_FNS[id](w, h);
}

export function panelCount(id) {
  return { hero: 1, triptych: 3, mosaic: 4, split: 3, editorial: 4 }[id];
}
