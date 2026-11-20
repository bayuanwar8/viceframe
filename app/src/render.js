// VICEFRAME — the cover renderer. renderCover(ctx, W, H, state, opts) is a pure
// function of the project state: panels, grading, graphic elements, typography
// and finish. The preview and the PNG export call the same function, so what
// you see is what the file holds.

import { getLayout } from './layouts.js';
import { TYPE_STYLES, stickerForPhoto } from './state.js';
import { filterFor, applyTint, applyFinish } from './grade.js';
import {
  drawSunDisc, drawPalm, drawSkyline, drawNeonAccents,
  drawFilmFrame, drawNumbering, drawLocationLabel,
  drawCastTag, drawBillingBlock, drawSeal,
  drawQuoteStrip, drawBarcode, drawSticker, drawStarburstSeal,
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
          document.fonts.load('400 40px Pacifico'),
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

const TITLE_H = { hero: 0.24, triptych: 0.13, mosaic: 0.12, split: 0.13, editorial: 0.10, 'hero-mosaic': 0.13 };

// How far the support line moves up when the billing block is on: 0.018H
// — but only when the subtitle sits far enough above the support line to
// leave room (in layouts where the subtitle sits just above the support,
// e.g. the old portrait-mosaic stack, the support stays put and the billing
// block shrinks to its one essential line).
function billingShift(layout) {
  return (layout.text.support.y - layout.text.subtitle.y) >= 0.035 ? 0.018 : 0;
}

// Which panel pops out of its frame when pop-out is on (triptych: the centre
// panel; split: the hero panel; hero-mosaic: the hero panel). Other layouts
// ignore the pop-out toggle.
const POP_PANEL = { triptych: 1, split: 0, 'hero-mosaic': 0 };

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
    } else if (state.layout === 'hero-mosaic') {
      rect.x -= W * 0.008; rect.w += W * 0.016;
      rect.y -= H * 0.020; rect.h += H * 0.035; // hero breaks its frame
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
    // A panel whose top sits just above the title (hero-mosaic row 3) has
    // no room for a top tag — the letters would cover it. Park it at the
    // panel bottom, above the billing strip, instead.
    if (rect.y > titleTop - H * 0.10 && rect.y < titleTop + H * 0.02) {
      return { x: rect.x + W * 0.015, y: rect.y + rect.h - H * 0.075, align: 'left', size };
    }
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

// Vice Stripes: the chrome gradient with horizontal retro stripes cut into
// the letters. Rendered on a scratch canvas (the stripes use source-atop,
// which must not touch the photos underneath), then stamped onto the cover.
function drawStripedTitle(ctx, title, tx, ty, size, style, textW) {
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(2, Math.ceil(textW) + 4);
  tmp.height = Math.ceil(size * 1.25);
  const t = tmp.getContext('2d');
  t.font = `${style.weight} ${size}px "${style.font}", sans-serif`;
  if ('letterSpacing' in t) t.letterSpacing = `${(size * style.spacing).toFixed(1)}px`;
  t.textAlign = 'left';
  t.textBaseline = 'top';
  const grad = t.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.30, '#cfe9ff');
  grad.addColorStop(0.55, '#ff9ecf');
  grad.addColorStop(0.80, '#ff2e88');
  grad.addColorStop(1, '#7b2fff');
  t.fillStyle = grad;
  t.fillText(title, 0, 0);
  // Horizontal retro stripes over the letters only.
  t.globalCompositeOperation = 'source-atop';
  const bandH = size * 0.085;
  const stripeCols = ['rgba(255,255,255,0.92)', 'rgba(255,46,136,0.85)', 'rgba(255,255,255,0.92)', 'rgba(123,47,255,0.85)'];
  let y = size * 0.06;
  let k = 0;
  while (y < size) {
    t.fillStyle = stripeCols[k % stripeCols.length];
    t.fillRect(0, y, tmp.width, bandH * 0.55);
    y += bandH;
    k++;
  }
  ctx.save();
  ctx.drawImage(tmp, tx, ty);
  ctx.restore();
}

function drawTextBlock(ctx, W, H, state, layout, style) {
  const t = layout.text;
  const title = (state.title || '').trim().toUpperCase();
  const color = state.type.color || style.color;
  const align = state.type.align || 'center';
  const zoneW = t.title.w * W;
  const maxTitle = TITLE_H[state.layout] * H * (state.type.sizeScale || 1);
  const zoneX = t.title.x * W;

  // A dark scrim ONLY behind the title block, so the type reads on any
  // photo while the photos stay visible around it — no separate dark band
  // below the panels. A second, thinner scrim guards the billing strip.
  const titleH = TITLE_H[state.layout] * H * (state.type.sizeScale || 1);
  const bandTop = t.title.y * H - H * 0.075;
  const bandBot = t.title.y * H + titleH + H * 0.10;
  const scrim = ctx.createLinearGradient(0, bandTop, 0, bandBot);
  scrim.addColorStop(0, 'rgba(12,2,28,0)');
  scrim.addColorStop(0.18, 'rgba(12,2,28,0.55)');
  scrim.addColorStop(0.75, 'rgba(12,2,28,0.55)');
  scrim.addColorStop(1, 'rgba(12,2,28,0)');
  ctx.save();
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop, W, bandBot - bandTop);
  ctx.restore();
  const strip = ctx.createLinearGradient(0, H * 0.925, 0, H);
  strip.addColorStop(0, 'rgba(12,2,28,0)');
  strip.addColorStop(1, 'rgba(12,2,28,0.6)');
  ctx.save();
  ctx.fillStyle = strip;
  ctx.fillRect(0, H * 0.925, W, H * 0.075);
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
      if (style.stripes) {
        // Vice Stripes: the gradient + retro stripes on a scratch canvas,
        // then a dark outline stroked on top.
        const textW = ctx.measureText(title).width;
        const leftX = t.title.align === 'center' ? tx - textW / 2
          : t.title.align === 'right' ? tx - textW : tx;
        drawStripedTitle(ctx, title, leftX, ty, size, style, textW);
        if (style.strokeWidth > 0) {
          ctx.lineWidth = Math.max(1, size * style.strokeWidth);
          ctx.strokeStyle = style.stroke;
          ctx.shadowColor = 'rgba(0,229,255,0.6)';
          ctx.shadowBlur = size * style.shadowBlur;
          ctx.strokeText(title, tx, ty);
        }
      } else {
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
      }
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

  // Subtitle: Oswald caps with wide tracking, in the accent colour — or,
  // with the Vice Script style, a neon-pink script line (Pacifico, kept in
  // the case it was typed, not uppercased) with a white outline.
  const subRaw = (state.subtitle || '').trim();
  const sub = style.script ? subRaw : subRaw.toUpperCase();
  if (sub) {
    const size = style.script ? Math.max(14, W * 0.030) : Math.max(12, W * 0.022);
    ctx.save();
    if (style.script) {
      ctx.font = `400 ${size}px Pacifico, cursive`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.fillStyle = '#ff9ecf';
      ctx.shadowColor = 'rgba(255,46,136,0.95)';
      ctx.shadowBlur = size * 0.5;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.font = `600 ${size}px Oswald, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * 0.32).toFixed(1)}px`;
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = size * 0.3;
    }
    ctx.textAlign = t.subtitle.align;
    ctx.textBaseline = 'top';
    const sx = t.subtitle.align === 'center' ? t.subtitle.x * W + t.subtitle.w * W / 2
      : t.subtitle.align === 'right' ? (t.subtitle.x + t.subtitle.w) * W : t.subtitle.x * W;
    if (style.script) ctx.strokeText(sub, sx, t.subtitle.y * H);
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

  // Review quote strip: five gold stars + a quote + the paper. Skipped
  // when the title sits at the very top (editorial), where there is no room
  // above it. Where it sits depends on the layout: above the title when the
  // subtitle runs below it; above the subtitle when the subtitle is a
  // kicker above the title (hero, split); higher still in hero-mosaic
  // (row-2 bottom tags) and portrait mosaic (subtitle kicker + face).
  if (el.quote && (state.quote || '').trim() && layout.text.title.y >= 0.15) {
    const portrait = H > W * 1.1;
    let quoteY;
    if (state.layout === 'hero-mosaic' || (state.layout === 'mosaic' && portrait)) {
      quoteY = layout.text.title.y - 0.10;
    } else if (state.layout === 'mosaic') {
      // Square mosaic: the subtitle kicker sits at 0.805 above the title
      // and the bottom panel's face sits just below it, so the quote rides
      // at the top of the bottom panel instead — clear of face, tag and
      // sticker. (Wide mosaic keeps the default below-the-title spot.)
      const square = Math.abs(W - H) < W * 0.1;
      quoteY = square ? layout.panels[layout.panels.length - 1].y + 0.02
        : layout.text.title.y - 0.062;
    } else if (layout.text.subtitle.y < layout.text.title.y) {
      quoteY = layout.text.subtitle.y - 0.05;
    } else {
      quoteY = layout.text.title.y - 0.062;
    }
    drawQuoteStrip(ctx, W, H, (state.quote || '').trim().toUpperCase(),
      (state.quoteSource || '').trim().toUpperCase(),
      quoteY * H);
  }

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
    // Centred in the middle of the bottom strip: COMING SOON sits left and
    // the barcode sits right, so the credits run narrower than before.
    drawBillingBlock(ctx, W, H, lines, W * 0.50, (supY + 0.014) * H, W * 0.52);
  }

  // Barcode + COMING SOON strip: a deterministic ticket barcode bottom-right
  // and the release line bottom-left, flanking the billing block.
  if (el.barcode) {
    drawBarcode(ctx, W * 0.865, H * 0.948, W * 0.105, H * 0.032, 2026);
    ctx.save();
    ctx.font = `600 ${Math.max(11, W * 0.014)}px Oswald, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,46,136,0.9)';
    ctx.shadowBlur = Math.max(4, W * 0.004);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(Math.max(11, W * 0.014) * 0.22).toFixed(1)}px`;
    // Baseline 0.985H: the support line rides as high as 0.954H (portrait
    // mosaic), so the old 0.972H baseline printed COMING SOON on top of it.
    ctx.fillText('COMING SOON', W * 0.03, H * 0.985);
    ctx.restore();
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Seal stamp, overlapping the bottom-right panel corner above the
  // billing strip (the barcode now owns the strip's right end).
  if (el.seal) {
    const r = Math.max(26, Math.min(W, H) * 0.042);
    drawSeal(ctx, W * 0.94, H * 0.885, r);
  }
  // Starburst seal: stamped over a panel seam, clear of the quote strip and
  // of faces. Hero-mosaic's seam sits between the club and neon panels;
  // other layouts use the right-hand panel's lower area.
  const STAR_POS = {
    hero: [0.885, 0.60], triptych: [0.885, 0.60], mosaic: [0.885, 0.60],
    split: [0.885, 0.60], editorial: [0.885, 0.60], 'hero-mosaic': [0.545, 0.33],
  };
  if (el.starburst) {
    const r = Math.max(26, Math.min(W, H) * 0.042);
    const sp = STAR_POS[state.layout] || [0.885, 0.60];
    drawStarburstSeal(ctx, W * sp[0], H * sp[1], r * 0.95);
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
  // Location/time stickers: one white tilted sticker per panel, from the
  // photo's sticker map. Top-right of the panel, unless the panel's cast
  // tag already moved up there (then top-left); never over the global
  // location label or the issue numbering.
  if (el.stickers) {
    const titleTop = layout.text.title.y * H;
    layout.panels.forEach((p, i) => {
      const name = state.photos[state.panels[i]?.photo]?.name || '';
      const sticker = stickerForPhoto(name);
      if (!sticker) return;
      const rect = { x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H };
      const tagIsTop = rect.y + rect.h > titleTop - H * 0.02;
      const tagNearTitle = rect.y > titleTop - H * 0.10 && rect.y < titleTop + H * 0.02;
      // The tag sits at the top only when it is not parked at the bottom
      // near the title (hero-mosaic row 3) — then the top-right is free.
      let align = tagIsTop && !tagNearTitle ? 'left' : 'right';
      const hasLoc = rect.x < W * 0.06 + W * 0.2 && rect.x + rect.w > W * 0.06 && rect.y < H * 0.05 + H * 0.02 && rect.y + rect.h > H * 0.05;
      const hasNum = rect.x < W * 0.97 && rect.x + rect.w > W * 0.97 && rect.y < H * 0.045 + H * 0.02 && rect.y + rect.h > H * 0.045;
      if (hasLoc && align === 'left') align = 'right';
      if (hasNum && align === 'right') align = 'left';
      const sx = align === 'left' ? rect.x + W * 0.012 : rect.x + rect.w - W * 0.012;
      // When the cast tag already owns the top-right corner (and the
      // sticker ended up on the same side), park the sticker below the tag
      // instead of painting over it.
      const tagAtTopRight = tagIsTop && !tagNearTitle && align === 'right';
      const tagSize = Math.max(11, W * 0.013);
      const tagTopY = rect.y === 0 && rect.w > W * 0.9 ? H * 0.075 : H * 0.018;
      const sy = tagAtTopRight
        ? rect.y + tagTopY + tagSize * 2.1 + H * 0.008
        : rect.y + H * 0.008;
      drawSticker(ctx, sx, sy, align, sticker, Math.max(10, W * 0.011));
    });
  }
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
