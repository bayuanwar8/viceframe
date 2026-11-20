// VICEFRAME — the cover renderer. renderCover(ctx, W, H, state, opts) is a pure
// function of the project state: panels, grading, graphic elements, typography
// and finish. The preview and the PNG export call the same function, so what
// you see is what the file holds.

import { getLayout } from './layouts.js';
import { TYPE_STYLES } from './state.js';
import { filterFor, applyTint, applyFinish } from './grade.js';
import {
  drawSunDisc, drawPalm, drawSkyline, drawNeonAccents,
  drawFilmFrame, drawNumbering, drawLocationLabel,
  drawCastTag, drawBillingBlock, drawSeal,
} from './elements.js';

let fontsReadyPromise = null;
export function fontsReady() {
  if (!fontsReadyPromise) {
    fontsReadyPromise = (async () => {
      try {
        await Promise.all([
          document.fonts.load('400 100px "Bebas Neue"'),
          document.fonts.load('600 40px Oswald'),
          document.fonts.load('400 40px Oswald'),
          document.fonts.load('300 40px Oswald'),
        ]);
        await document.fonts.ready;
      } catch (e) { /* fall back to system fonts if a vendored font fails */ }
    })();
  }
  return fontsReadyPromise;
}

// Cover-fit draw of one photo into a panel rect, honouring the panel's zoom,
// pan and focal point. The focal point stays centred as you zoom in.
export function drawPhotoCover(ctx, img, rect, panel) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const pw = rect.w; const ph = rect.h;
  const base = Math.max(pw / iw, ph / ih);
  const scale = base * (panel.zoom || 1);
  const vw = pw / scale; const vh = ph / scale;
  let cx = (panel.fx ?? 0.5) * iw + (panel.dx || 0) * vw * 0.5;
  let cy = (panel.fy ?? 0.5) * ih + (panel.dy || 0) * vh * 0.5;
  cx = Math.min(Math.max(cx, vw / 2), iw - vw / 2);
  cy = Math.min(Math.max(cy, vh / 2), ih - vh / 2);
  const sx = Math.max(0, cx - vw / 2);
  const sy = Math.max(0, cy - vh / 2);
  ctx.drawImage(img, sx, sy, Math.min(vw, iw), Math.min(vh, ih), rect.x, rect.y, pw, ph);
}

const TITLE_H = { hero: 0.24, triptych: 0.14, mosaic: 0.12, split: 0.13, editorial: 0.10 };

// How far the support line moves up when the billing block is on: 0.018H
// — but only when the subtitle sits far enough above the support line to
// leave room. In the portrait mosaic the subtitle (0.95) and support (0.972)
// are already 0.022 apart, so shifting the support up would print the two
// lines on top of each other; there the support stays put and the billing
// block shrinks to its one essential line.
function billingShift(layout) {
  return (layout.text.support.y - layout.text.subtitle.y) >= 0.035 ? 0.018 : 0;
}

// Which panel pops out of its frame when pop-out is on (triptych: the centre
// panel; split: the hero panel). Other layouts ignore the pop-out toggle.
const POP_PANEL = { triptych: 1, split: 0 };

// Per-panel draw geometry: slant (triptych) turns panel rects into
// parallelograms with diagonal dividers; pop-out expands one panel past its
// frame so it overlaps its neighbours. Returns { rect, poly, isPop } where
// poly is the clip polygon (null = plain rect).
function panelGeometry(p, i, W, H, state) {
  const rect = { x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H };
  const isPop = !!state.elements.popout && POP_PANEL[state.layout] === i;
  if (isPop) {
    if (state.layout === 'triptych') {
      rect.x -= W * 0.010; rect.w += W * 0.020;
      rect.y -= H * 0.028; rect.h += H * 0.045;
    } else if (state.layout === 'split') {
      rect.h += H * 0.030; // hero panel spills over the support panels below
    }
  }
  const slant = !!state.elements.slant && state.layout === 'triptych';
  const dx = slant ? W * 0.028 : 0;
  const poly = slant ? [
    [rect.x + dx, rect.y], [rect.x + rect.w + dx, rect.y],
    [rect.x + rect.w - dx, rect.y + rect.h], [rect.x - dx, rect.y + rect.h],
  ] : null;
  return { rect, poly, isPop };
}

// Where a panel's cast tag sits. Bottom of the panel, unless the panel's
// bottom runs into the title band — then the top of the panel, right-aligned
// (and dropped below the issue numbering for full-width top panels).
function tagAnchor(p, W, H, layout) {
  const rect = { x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H };
  const size = Math.max(11, W * 0.013);
  const tagH = size * 2.1;
  const titleTop = layout.text.title.y * H;
  if (rect.y + rect.h > titleTop - H * 0.02) {
    const topY = rect.y + (rect.y === 0 && rect.w > W * 0.9 ? H * 0.075 : H * 0.018);
    return { x: rect.x + rect.w - W * 0.015, y: topY + tagH, align: 'right', size };
  }
  return { x: rect.x + W * 0.015, y: rect.y + rect.h - H * 0.012, align: 'left', size };
}

function tracePoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], j) => { if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.closePath();
}

function fitTitle(ctx, text, zoneW, maxSize, style) {
  let size = maxSize;
  const set = (s) => {
    ctx.font = `${style.weight} ${s}px "${style.font}", sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(s * style.spacing).toFixed(1)}px`;
  };
  set(size);
  while (size > 10 && ctx.measureText(text).width > zoneW) {
    size -= Math.max(1, size * 0.04);
    set(size);
  }
  return size;
}

function drawTextBlock(ctx, W, H, state, layout, style) {
  const t = layout.text;
  const title = (state.title || '').trim().toUpperCase();
  const color = state.type.color || style.color;
  const align = state.type.align || 'center';
  const zoneW = t.title.w * W;
  const maxTitle = TITLE_H[state.layout] * H * (state.type.sizeScale || 1);
  const zoneX = t.title.x * W;

  // A dark scrim behind the title so white type reads on any photo.
  const scrimTop = t.title.y * H - H * 0.06;
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
  scrim.addColorStop(0, 'rgba(12,2,28,0)');
  scrim.addColorStop(1, 'rgba(12,2,28,0.62)');
  ctx.save();
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);
  ctx.restore();

  if (title) {
    const size = fitTitle(ctx, title, zoneW, maxTitle, style);
    ctx.save();
    ctx.textAlign = t.title.align;
    ctx.textBaseline = 'top';
    const tx = t.title.align === 'center' ? zoneX + zoneW / 2
      : t.title.align === 'right' ? zoneX + zoneW : zoneX;
    const ty = t.title.y * H;
    if (style.chrome) {
      // Vice Chrome: stacked dark extrude copies stepping down-right (the
      // 3D depth), then a chrome gradient fill with a dark outline.
      ctx.shadowBlur = 0;
      const steps = [0.014, 0.026, 0.038];
      const cols = ['#3d0a5c', '#2a0640', '#1a0b2e'];
      steps.forEach((s, k) => {
        ctx.fillStyle = cols[k];
        ctx.fillText(title, tx + size * s, ty + size * s);
      });
      const grad = ctx.createLinearGradient(0, ty, 0, ty + size);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.30, '#cfe9ff');
      grad.addColorStop(0.55, '#ff9ecf');
      grad.addColorStop(0.80, '#ff2e88');
      grad.addColorStop(1, '#7b2fff');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(0,229,255,0.6)';
      ctx.shadowBlur = size * style.shadowBlur;
      if (style.strokeWidth > 0) {
        ctx.lineWidth = Math.max(1, size * style.strokeWidth);
        ctx.strokeStyle = style.stroke;
        ctx.strokeText(title, tx, ty);
      }
      ctx.fillText(title, tx, ty);
    } else {
      ctx.fillStyle = color;
      ctx.shadowColor = style.shadow;
      ctx.shadowBlur = size * style.shadowBlur;
      if (style.strokeWidth > 0) {
        ctx.lineWidth = Math.max(1, size * style.strokeWidth);
        ctx.strokeStyle = style.stroke;
        ctx.strokeText(title, tx, ty);
      }
      ctx.fillText(title, tx, ty);
    }
    ctx.restore();
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Subtitle: Oswald caps with wide tracking, in the accent colour.
  const sub = (state.subtitle || '').trim().toUpperCase();
  if (sub) {
    const size = Math.max(12, W * 0.022);
    ctx.save();
    ctx.font = `600 ${size}px Oswald, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * 0.32).toFixed(1)}px`;
    ctx.textAlign = t.subtitle.align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.3;
    const sx = t.subtitle.align === 'center' ? t.subtitle.x * W + t.subtitle.w * W / 2
      : t.subtitle.align === 'right' ? (t.subtitle.x + t.subtitle.w) * W : t.subtitle.x * W;
    ctx.fillText(sub, sx, t.subtitle.y * H);
    ctx.restore();
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Supporting line: small Oswald, white, low in the frame. When the
  // billing block is on it moves up a touch to make room for the credits.
  const sup = (state.support || '').trim().toUpperCase();
  if (sup) {
    const size = Math.max(10, W * 0.013);
    ctx.save();
    ctx.font = `400 ${size}px Oswald, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * 0.22).toFixed(1)}px`;
    ctx.textAlign = t.support.align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.3;
    const sx = t.support.align === 'center' ? t.support.x * W + t.support.w * W / 2
      : t.support.align === 'right' ? (t.support.x + t.support.w) * W : t.support.x * W;
    const supY = (t.support.y - (state.elements.billing ? billingShift(layout) : 0)) * H;
    ctx.fillText(sup, sx, supY);
    ctx.restore();
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
}

export async function renderCover(canvas, state, opts = {}) {
  await fontsReady();
  const W = canvas.width; const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const g = state.gradeManual;
  const layout = getLayout(state.layout, W, H);
  const style = TYPE_STYLES[state.typeStyle] || TYPE_STYLES['vice-block'];
  const el = state.elements;

  // Base: deep violet so panel gaps read as an editorial grid.
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, W, H);

  // Panels: photo + grade, clipped to each rect (or slanted polygon).
  // The pop-out panel is drawn last so it overlaps its neighbours.
  const geoms = layout.panels.map((p, i) => panelGeometry(p, i, W, H, state));
  const order = geoms.map((_, i) => i)
    .sort((a, b) => (geoms[a].isPop ? 1 : 0) - (geoms[b].isPop ? 1 : 0));
  for (const i of order) {
    const { rect, poly, isPop } = geoms[i];
    const panel = state.panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0, fx: 0.5, fy: 0.35 };
    const photo = state.photos[panel.photo] || state.photos[0];
    if (isPop) {
      // Soft drop shadow under the popped panel: the polygon filled black
      // on a scratch canvas, blurred, drawn a touch lower.
      const sh = document.createElement('canvas');
      sh.width = W; sh.height = H;
      const sctx = sh.getContext('2d');
      sctx.fillStyle = 'rgba(0,0,0,0.85)';
      sctx.beginPath();
      if (poly) tracePoly(sctx, poly); else sctx.rect(rect.x, rect.y, rect.w, rect.h);
      sctx.fill();
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.globalAlpha = 0.75;
      ctx.drawImage(sh, 0, H * 0.010);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    if (poly) tracePoly(ctx, poly); else ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (photo && photo.img) {
      ctx.filter = filterFor(g);
      drawPhotoCover(ctx, photo.img, rect, panel);
      ctx.filter = 'none';
      applyTint(ctx, rect.x, rect.y, rect.w, rect.h, g);
    } else {
      // Empty panel: a graded placeholder, never a hole in the cover.
      const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      grad.addColorStop(0, '#3d1c5c');
      grad.addColorStop(1, '#12081f');
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    // Frame around each panel: glowing neon for the popped one, thin
    // editorial white for the rest; slanted panels stroke the polygon.
    ctx.save();
    if (isPop) {
      ctx.strokeStyle = '#ff2e88';
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = Math.max(6, W * 0.012);
      ctx.lineWidth = Math.max(3, W * 0.004);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = Math.max(1, W * 0.0015);
    }
    ctx.beginPath();
    if (poly) tracePoly(ctx, poly);
    else ctx.rect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.stroke();
    ctx.restore();
  }

  // Graphic elements, drawn over the photos.
  if (el.sunDisc) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.9;
    drawSunDisc(ctx, layout.sun.x * W, layout.sun.y * H, layout.sun.r * W);
    ctx.restore();
  }
  // Skyline sits low and DIMMED, behind the title scrim, so it never cuts
  // a face or slices the subtitle/support/billing lines: the strip is short
  // and half-transparent, a faint city backdrop under the credits.
  if (el.skyline) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawSkyline(ctx, 0, H * 0.925, W, H * 0.055);
    ctx.restore();
  }
  if (el.palms) {
    const ph = H * 0.14;
    drawPalm(ctx, W * 0.045, H * 0.995, ph, -0.10);
    drawPalm(ctx, W * 0.955, H * 0.995, ph * 0.85, 0.12);
    // Palm clusters so the bottom edge reads as a grove, not two lone trees.
    drawPalm(ctx, W * 0.115, H * 0.995, ph * 0.55, 0.08);
    drawPalm(ctx, W * 0.84, H * 0.995, ph * 0.62, -0.06);
    if (state.layout === 'hero') drawPalm(ctx, W * 0.14, H * 0.995, ph * 0.6, 0.06);
  }
  if (el.neon) drawNeonAccents(ctx, W, H);

  // Typography on top.
  drawTextBlock(ctx, W, H, state, layout, style);

  // Cast role tags: one chip per panel, anchored to the panel's own rect
  // (the layout rect, not the expanded pop-out rect) so it never lands on
  // the title. The popped panel's tag stays inside its original frame.
  if (el.castTags) {
    layout.panels.forEach((p, i) => {
      const tag = (state.panels[i] && state.panels[i].tag) || '';
      if (!tag) return;
      const a = tagAnchor(p, W, H, layout);
      drawCastTag(ctx, a.x, a.y, a.align, tag.toUpperCase(), a.size);
    });
  }

  // Billing block: micro credits under the support line, starring the cast
  // roles actually on the cover. Two lines when they fit before the bottom
  // edge, otherwise just the cast line (the essential credit).
  if (el.billing) {
    const roles = [...new Set(state.panels.map((p) => (p.tag || '').trim()).filter(Boolean))];
    const cast = roles.length ? roles.join('  ·  ') : 'THE ANGLER  ·  THE DRIVER  ·  THE NIGHT OWL';
    const castLine = `${cast}  —  DIRECTED BY COLE MARLIN  ·  MUSIC BY NEON TIDE`;
    const supY = layout.text.support.y - billingShift(layout);
    const twoLines = supY + 0.014 + 2 * 0.0135 < 0.995;
    const lines = twoLines ? ['VICEFRAME PICTURES PRESENTS', castLine] : [castLine];
    const cx = el.seal ? W * 0.45 : W * 0.5;
    drawBillingBlock(ctx, W, H, lines, cx, (supY + 0.014) * H, W * 0.82);
  }

  // Seal stamp, bottom-right corner.
  if (el.seal) {
    const r = Math.max(26, Math.min(W, H) * 0.042);
    drawSeal(ctx, W * 0.925, H * 0.94, r);
  }

  // Labels, numbering, film frame.
  if (el.location || el.numbering) {
    // Top scrim behind the location label + numbering so white type reads
    // on bright skies: the old bare shadow was too weak on pale photos.
    const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.10);
    topScrim.addColorStop(0, 'rgba(12,2,28,0.55)');
    topScrim.addColorStop(1, 'rgba(12,2,28,0)');
    ctx.save();
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, W, H * 0.10);
    ctx.restore();
  }
  if (el.location) {
    drawLocationLabel(ctx, layout.text.location.x * W, layout.text.location.y * H + Math.max(12, W * 0.016), Math.max(12, W * 0.016), 'NEON BAY · 26.1°N');
  }
  if (el.numbering) drawNumbering(ctx, W, H, '01');
  if (el.filmFrame) drawFilmFrame(ctx, W, H);

  // Finish: vignette, grain, halftone.
  applyFinish(ctx, W, H, g);

  // Preview-only: highlight the selected panel.
  if (opts.highlightPanel != null && opts.highlightPanel >= 0) {
    const p = layout.panels[opts.highlightPanel];
    if (p) {
      ctx.save();
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.setLineDash([Math.max(8, W * 0.012), Math.max(6, W * 0.008)]);
      ctx.strokeRect(p.x * W + 2, p.y * H + 2, p.w * W - 4, p.h * H - 4);
      ctx.restore();
    }
  }
  return layout;
}
