// VICEFRAME — colour grading. A preset is a set of manual values; the renderer
// applies them in two passes: (1) ctx.filter on the photo draw itself, (2)
// overlay gradients clipped to the panel, then whole-cover vignette, grain and
// halftone. Grain uses a seeded noise tile so a cover looks the same every time
// it is rendered in one session.

// Deterministic PRNG (mulberry32) so the noise tile never changes mid-session.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let noiseTile = null;
export function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const rand = mulberry32(20261120);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return noiseTile;
}

let dotTile = null;
export function getDotTile() {
  if (dotTile) return dotTile;
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(12, 12, 4.5, 0, Math.PI * 2); ctx.fill();
  dotTile = c;
  return dotTile;
}

/** CSS filter string for a photo draw from manual grading values. */
export function filterFor(g) {
  const parts = [
    `brightness(${g.exposure.toFixed(3)})`,
    `contrast(${g.contrast.toFixed(3)})`,
    `saturate(${g.saturation.toFixed(3)})`,
  ];
  // Temperature: warm = a touch of sepia + hue shift toward orange,
  // cold = hue shift toward blue.
  if (g.temperature > 0) {
    parts.push(`sepia(${(g.temperature / 160).toFixed(3)})`);
    parts.push(`hue-rotate(${(-g.temperature * 0.35).toFixed(1)}deg)`);
  } else if (g.temperature < 0) {
    parts.push(`hue-rotate(${(-g.temperature * 0.6).toFixed(1)}deg)`);
  }
  return parts.join(' ');
}

/** Sunset/neon tint overlay + highlight/shadow shaping, clipped to the panel. */
export function applyTint(ctx, x, y, w, h, g) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const tint = ctx.createLinearGradient(x, y, x, y + h);
  tint.addColorStop(0, g.tintA);
  tint.addColorStop(1, g.tintB);
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  // Lift the highlights: a soft white wash from the top.
  if (g.highlights > 1) {
    const hi = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    hi.addColorStop(0, `rgba(255,240,210,${((g.highlights - 1) * 0.35).toFixed(3)})`);
    hi.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(x, y, w, h * 0.45);
  } else if (g.highlights < 1) {
    const hi = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    hi.addColorStop(0, `rgba(20,0,40,${((1 - g.highlights) * 0.30).toFixed(3)})`);
    hi.addColorStop(1, 'rgba(20,0,40,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(x, y, w, h * 0.45);
  }
  // Deepen the shadows: a dark wash rising from the bottom.
  if (g.shadows > 1) {
    const sh = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
    sh.addColorStop(0, 'rgba(5,0,20,0)');
    sh.addColorStop(1, `rgba(5,0,20,${((g.shadows - 1) * 0.45).toFixed(3)})`);
    ctx.fillStyle = sh;
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  }
  ctx.restore();
}

/** Whole-cover vignette, grain and halftone, drawn last. */
export function applyFinish(ctx, w, h, g) {
  if (g.vignette > 0) {
    const r = Math.hypot(w, h) / 2;
    const v = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${(g.vignette * 0.85).toFixed(3)})`);
    ctx.save();
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (g.grain > 0) {
    ctx.save();
    ctx.globalAlpha = g.grain * 0.5;
    ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(getNoiseTile(), 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (g.halftone > 0) {
    ctx.save();
    ctx.globalAlpha = g.halftone * 0.55;
    ctx.globalCompositeOperation = 'multiply';
    const pat = ctx.createPattern(getDotTile(), 'repeat');
    ctx.fillStyle = pat;
    // Halftone lives in the lower third, where the type sits.
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.restore();
  }
}
