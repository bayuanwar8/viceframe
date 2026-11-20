// VICEFRAME — original graphic elements, all drawn in code (Canvas 2D).
// No clip-art, no borrowed artwork: a sunset disc with banded haze, palm
// silhouettes grown from bezier fronds, a coastal skyline with lit windows,
// neon chevrons, a film-frame border, editorial numbering and location labels.

// Sunset disc: a big warm circle with horizontal haze bands cut out of it.
// Rendered on a scratch canvas first (the bands use destination-out, which
// must not erase the photo underneath on the main canvas).
export function drawSunDisc(ctx, cx, cy, r) {
  const pad = 2;
  const s = Math.ceil((r + pad) * 2);
  const tmp = document.createElement('canvas');
  tmp.width = s; tmp.height = s;
  const t = tmp.getContext('2d');
  const c = r + pad;
  const g = t.createLinearGradient(0, c - r, 0, c + r);
  g.addColorStop(0, '#ffe259');
  g.addColorStop(0.45, '#ff7e5f');
  g.addColorStop(1, '#ff2e88');
  t.fillStyle = g;
  t.beginPath(); t.arc(c, c, r, 0, Math.PI * 2); t.fill();
  // Haze bands: dark horizontal slices that widen toward the bottom.
  t.globalCompositeOperation = 'destination-out';
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const by = c - r * 0.15 + i * r * 0.34;
    const bh = r * (0.05 + i * 0.022);
    t.fillRect(c - r, by, r * 2, bh);
  }
  ctx.save();
  ctx.drawImage(tmp, cx - c, cy - c);
  ctx.restore();
}

// One palm tree silhouette at (x, y) = base of the trunk, height h.
export function drawPalm(ctx, x, y, h, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean || 0);
  ctx.strokeStyle = '#14081f';
  ctx.fillStyle = '#14081f';
  ctx.lineWidth = Math.max(2, h * 0.035);
  ctx.lineCap = 'round';
  // Trunk: a gentle curve.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(h * 0.03, -h * 0.55, h * 0.10, -h * 0.92);
  ctx.stroke();
  const tx = h * 0.10; const ty = -h * 0.92;
  // Fronds: seven arcs drooping from the crown.
  for (let i = 0; i < 7; i++) {
    const a = (-Math.PI * 0.92) + (i * Math.PI * 0.30);
    const len = h * (0.42 + (i % 2) * 0.06);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.55 + h * 0.16;
    const mx = tx + Math.cos(a) * len * 0.55;
    const my = ty + Math.sin(a) * len * 0.55 - h * 0.10;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.lineWidth = Math.max(1.5, h * 0.016);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath(); ctx.arc(tx - h * 0.02, ty + h * 0.03, h * 0.025, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx + h * 0.03, ty + h * 0.04, h * 0.022, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Coastal skyline: a strip of dark towers with lit windows along y.
export function drawSkyline(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#160a24';
  let bx = x;
  let i = 0;
  while (bx < x + w - 8) {
    const bw = w * (0.05 + ((i * 37) % 10) / 120);
    const bh = h * (0.35 + ((i * 53) % 10) / 16);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    // Antenna on every third tower.
    if (i % 3 === 1) ctx.fillRect(bx + bw / 2 - 1, y + h - bh - h * 0.16, 2, h * 0.16);
    // Lit windows: a few warm dots.
    ctx.fillStyle = 'rgba(255,190,90,0.9)';
    const rows = Math.max(1, Math.floor(bh / (h * 0.09)));
    for (let r = 0; r < rows; r++) {
      if ((i * 7 + r * 3) % 4 === 0) {
        ctx.fillRect(bx + bw * 0.2, y + h - bh + h * 0.06 + r * h * 0.09, bw * 0.22, h * 0.035);
      }
    }
    ctx.fillStyle = '#160a24';
    bx += bw + w * 0.012;
    i++;
  }
  ctx.restore();
}

// Neon chevrons / geometric accents: two glowing lines framing a corner.
export function drawNeonAccents(ctx, w, h) {
  ctx.save();
  ctx.lineCap = 'round';
  const lines = [
    { color: '#ff2e88', pts: [[w * 0.02, h * 0.30], [w * 0.02, h * 0.02], [w * 0.14, h * 0.02]] },
    { color: '#00e5ff', pts: [[w * 0.98, h * 0.70], [w * 0.98, h * 0.98], [w * 0.86, h * 0.98]] },
  ];
  for (const l of lines) {
    ctx.strokeStyle = l.color;
    ctx.shadowColor = l.color;
    ctx.shadowBlur = Math.max(6, w * 0.012);
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(l.pts[0][0], l.pts[0][1]);
    for (let i = 1; i < l.pts.length; i++) ctx.lineTo(l.pts[i][0], l.pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// Film-frame border: dark rails top and bottom with sprocket holes.
export function drawFilmFrame(ctx, w, h) {
  ctx.save();
  const rail = h * 0.045;
  ctx.fillStyle = '#0d0518';
  ctx.fillRect(0, 0, w, rail);
  ctx.fillRect(0, h - rail, w, rail);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const holeW = w * 0.02; const holeH = rail * 0.45; const step = w * 0.045;
  for (let x = w * 0.02; x < w - holeW; x += step) {
    ctx.fillRect(x, rail * 0.28, holeW, holeH);
    ctx.fillRect(x, h - rail + rail * 0.28, holeW, holeH);
  }
  ctx.restore();
}

// Editorial numbering: "No. 01" + a thin rule, top-right of the cover.
export function drawNumbering(ctx, w, h, issue) {
  ctx.save();
  const size = Math.max(14, w * 0.016);
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.3;
  ctx.fillText(`No. ${issue}`, w * 0.97, h * 0.045 + size * 0.5);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(w * 0.97 - w * 0.06, h * 0.045 + size * 0.9, w * 0.06, Math.max(2, h * 0.003));
  ctx.restore();
}

// Small location label with a pin dot, e.g. "VICE COAST — 26.1° N".
export function drawLocationLabel(ctx, x, y, size, text) {
  ctx.save();
  ctx.font = `600 ${size}px Oswald, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.arc(x + size * 0.35, y - size * 0.35, size * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = size * 0.35;
  ctx.fillText(text, x + size * 0.95, y);
  ctx.restore();
}
