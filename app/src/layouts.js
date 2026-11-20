// VICEFRAME — the six original layouts. Each layout is a function of the canvas
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
  // Panels run almost to the bottom (0.94H) so the giant title overlaps
  // the photos instead of sitting in a separate dark band below them.
  const panels = [0, 1, 2].map((i) => ({
    x: i * (pw + g), y: a === 'wide' ? 0.02 : 0, w: pw, h: a === 'wide' ? 0.92 : 0.94,
  }));
  const text = {
    title: { x: 0.04, y: 0.76, w: 0.92, align: 'center' },
    subtitle: { x: 0.04, y: 0.905, w: 0.92, align: 'center' },
    support: { x: 0.04, y: 0.955, w: 0.92, align: 'center' },
    location: { x: 0.04, y: 0.02, w: 0.5, align: 'left' },
  };
  if (a === 'wide') {
    text.title.y = 0.76; text.subtitle.y = 0.905;
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
    // The title zone stops at 0.84W so the wide left-aligned title never
    // runs into the seal stamp at the right edge.
    title: { x: 0.04, y: 0.845, w: 0.80, align: 'left' },
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
    // Text block sits low in the bottom band with the subtitle ABOVE the
    // title (a script kicker): the old subtitle below the title at y 0.95
    // printed on top of the support line and COMING SOON, and a subtitle
    // at y 0.82 would cross a face in the bottom panel — 0.78 clears it.
    text.title = { x: 0.04, y: 0.845, w: 0.80, align: 'left' };
    text.subtitle = { x: 0.04, y: 0.78, w: 0.92, align: 'left' };
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

export const LAYOUT_FNS = { hero, triptych, mosaic, split, editorial, 'hero-mosaic': heroMosaic };

export function getLayout(id, w, h) {
  return LAYOUT_FNS[id](w, h);
}

export function panelCount(id) {
  return { hero: 1, triptych: 3, mosaic: 4, split: 3, editorial: 4, 'hero-mosaic': 7 }[id];
}

// Hero Mosaic: one big hero + six small panels, edge to edge with no empty
// field. Square/wide: hero is a full-height left column, six panels in a
// 2x3 grid on the right. Portrait: hero is a full-width top band, six
// panels in a 3x2 grid below. The title overlaps the bottom of the panels
// (title zone y ~0.70) and the script subtitle sits just below it.
function heroMosaic(w, h) {
  const a = aspectOf(w, h);
  const g = GAP;
  let panels;
  if (a === 'portrait') {
    const cw = (1 - 2 * g) / 3;
    const rh = (1 - 0.43 - g) / 2;
    panels = [
      { x: 0, y: 0, w: 1, h: 0.42 },
      { x: 0, y: 0.43, w: cw, h: rh },
      { x: cw + g, y: 0.43, w: cw, h: rh },
      { x: 2 * (cw + g), y: 0.43, w: cw, h: rh },
      { x: 0, y: 0.43 + rh + g, w: cw, h: rh },
      { x: cw + g, y: 0.43 + rh + g, w: cw, h: rh },
      { x: 2 * (cw + g), y: 0.43 + rh + g, w: cw, h: rh },
    ];
  } else {
    const hw = a === 'wide' ? 0.42 : 0.52;
    const gx = hw + g;
    const cw = (1 - gx - g) / 2;
    const rh = (1 - 2 * g) / 3;
    panels = [
      { x: 0, y: 0, w: hw, h: 1 },
      { x: gx, y: 0, w: cw, h: rh },
      { x: gx + cw + g, y: 0, w: cw, h: rh },
      { x: gx, y: rh + g, w: cw, h: rh },
      { x: gx + cw + g, y: rh + g, w: cw, h: rh },
      { x: gx, y: 2 * (rh + g), w: cw, h: rh },
      { x: gx + cw + g, y: 2 * (rh + g), w: cw, h: rh },
    ];
  }
  const text = {
    title: { x: 0.03, y: a === 'portrait' ? 0.68 : 0.70, w: 0.94, align: 'center' },
    subtitle: { x: 0.03, y: a === 'portrait' ? 0.835 : 0.845, w: 0.94, align: 'center' },
    support: { x: 0.03, y: 0.955, w: 0.94, align: 'center' },
    location: { x: 0.03, y: 0.02, w: 0.5, align: 'left' },
  };
  return { panels, text, sun: { x: 0.10, y: 0.06, r: 0.05 }, skylineY: 0.55 };
}
