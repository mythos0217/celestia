// 光学の描画（時間によらない）
import { arrow, line, text, fmt } from './draw.js';
import { refract } from '../models/optics/refraction.js';
import { XMAX } from '../models/optics/double-slit.js';
export const FILE_VERSION = '0.3.0';

// 波長 [nm] → 見た目の色（おおよそ）
export function waveColor(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else r = 1;
  return `rgb(${Math.round(255 * r)},${Math.round(255 * g)},${Math.round(255 * b)})`;
}

export const OPTICS = {
  'optics.refraction': {
    bounds() { return { xmin: -1.2, xmax: 1.2, ymin: -1, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C) {
      ctx.fillStyle = C.accent; ctx.globalAlpha = 0.04 + 0.06 * (p.n1 - 1); ctx.fillRect(V.X(-1.2), V.Y(1), 2.4 * V.s, V.s); ctx.globalAlpha = 0.04 + 0.06 * (p.n2 - 1); ctx.fillRect(V.X(-1.2), V.Y(0), 2.4 * V.s, V.s); ctx.globalAlpha = 1;
      line(ctx, [[V.X(-1.2), V.Y(0)], [V.X(1.2), V.Y(0)]], C.ink2, { width: 1.5 });
      line(ctx, [[V.X(0), V.Y(0.95)], [V.X(0), V.Y(-0.95)]], C.ink3, { width: 1, dash: [4, 4] });
      text(ctx, `媒質1  n₁ = ${fmt(p.n1)}`, 10, 18, C.ink2); text(ctx, `媒質2  n₂ = ${fmt(p.n2)}`, 10, V.H - 10, C.ink2);
      const t1 = p.theta1, L = 0.95, red = '#e0443a';
      arrow(ctx, V.X(-L * Math.sin(t1)), V.Y(L * Math.cos(t1)), V.X(0), V.Y(0), red, { width: 2.4 });
      const th2 = refract(p.n1, p.n2, t1);
      const rAlpha = th2 == null ? 1 : 0.35;
      ctx.globalAlpha = rAlpha; arrow(ctx, V.X(0), V.Y(0), V.X(L * Math.sin(t1)), V.Y(L * Math.cos(t1)), red, { width: 2.4, label: th2 == null ? '全反射' : '反射', font: '12px sans-serif' }); ctx.globalAlpha = 1;
      if (th2 != null) arrow(ctx, V.X(0), V.Y(0), V.X(L * Math.sin(th2)), V.Y(-L * Math.cos(th2)), red, { width: 2.4, label: '屈折', font: '12px sans-serif' });
      ctx.save(); ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), 0.28 * V.s, -Math.PI / 2 - t1, -Math.PI / 2); ctx.stroke();
      if (th2 != null) { ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), 0.28 * V.s, Math.PI / 2 - th2, Math.PI / 2); ctx.stroke(); } ctx.restore();
      text(ctx, `θ₁ = ${fmt(s.th1)}°`, V.X(-0.33), V.Y(0.35), C.ink, { align: 'center' });
      if (th2 != null) text(ctx, `θ₂ = ${fmt(s.th2)}°`, V.X(0.33), V.Y(-0.38), C.ink, { align: 'center' });
    },
  },
  'optics.lens': {
    bounds(p) { const b = Math.abs(p.f) * 3.2; return { xmin: -Math.max(p.a, 2 * Math.abs(p.f)) - 0.4, xmax: Math.max(b, 2), ymin: -1.4 * Math.max(p.h, 0.3) * 2, ymax: 1.4 * Math.max(p.h, 0.3) * 2 }; },
    draw(ctx, V, s, p, tr, C) {
      const b = V.b, f = p.f, H = (b.ymax - b.ymin) * 0.42, red = '#e0443a';
      line(ctx, [[V.X(b.xmin), V.Y(0)], [V.X(b.xmax), V.Y(0)]], C.ink3, { width: 1 });
      // レンズ（凸は両端が外向き、凹は内向きの矢じり）
      line(ctx, [[V.X(0), V.Y(-H)], [V.X(0), V.Y(H)]], C.accent, { width: 3 });
      // 凸レンズ：両端が外向きの矢じり、凹レンズ：内向き
      for (const sg of [1, -1]) { const y = V.Y(sg * H), d = f > 0 ? sg * 8 : -sg * 8; line(ctx, [[V.X(0) - 8, y + d], [V.X(0), y], [V.X(0) + 8, y + d]], C.accent, { width: 2 }); }
      for (const x of [f, -f]) { ctx.beginPath(); ctx.arc(V.X(x), V.Y(0), 3.5, 0, 2 * Math.PI); ctx.fillStyle = C.ink; ctx.fill(); }
      text(ctx, 'F', V.X(Math.abs(f)), V.Y(0) + 16, C.ink, { align: 'center' }); text(ctx, 'F', V.X(-Math.abs(f)), V.Y(0) + 16, C.ink, { align: 'center' });
      arrow(ctx, V.X(-p.a), V.Y(0), V.X(-p.a), V.Y(p.h), C.ink, { width: 2.6, label: '物体', font: '12px sans-serif' });
      const bi = s.b, top = [-p.a, p.h];
      const clipLine = (pts, col, dash) => { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, V.W, V.H); ctx.clip(); line(ctx, pts.map(([x, y]) => [V.X(x), V.Y(y)]), col, { width: 1.4, dash }); ctx.restore(); };
      const far = b.xmax + 50;
      // 光線1：光軸に平行 → 焦点を通る（凸）／焦点から出たように広がる（凹）
      const yAt = (x0, y0, x1, y1, x) => y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      clipLine([top, [0, p.h], [far, yAt(0, p.h, f, 0, far)]], red);
      // 光線2：レンズの中心を通って直進
      clipLine([top, [far, yAt(top[0], top[1], 0, 0, far)]], red);
      if (Number.isFinite(bi)) {
        const h2 = s.h2;
        if (bi < 0) {   // 虚像：光線を逆にのばす
          clipLine([[0, p.h], [bi, h2]], red, [4, 4]); clipLine([[0, 0], [bi, h2]], red, [4, 4]);
        }
        arrow(ctx, V.X(bi), V.Y(0), V.X(bi), V.Y(h2), bi > 0 ? C.force : C.comp, { width: 2.6, dash: bi > 0 ? null : [5, 4], label: bi > 0 ? '実像' : '虚像', font: '12px sans-serif' });
      }
      text(ctx, Number.isFinite(bi) ? `b = ${fmt(bi)} m　倍率 ${fmt(s.m)}　${bi > 0 ? '倒立の実像' : '正立の虚像'}` : '像はできない（平行光線）', 10, 18, C.ink2);
    },
  },
  'optics.double-slit': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C, model) {
      const W = V.W, H = V.H, col = waveColor(p.lambda);
      // 左：装置の模式図、右：スクリーンに映る縞（実際の明るさ）
      const sx = W * 0.12, slitX = W * 0.3, scrX = W * 0.62;
      ctx.fillStyle = col; ctx.globalAlpha = 0.8; ctx.fillRect(sx - 6, H / 2 - 6, 12, 12); ctx.globalAlpha = 1;
      line(ctx, [[slitX, 20], [slitX, H / 2 - 14]], C.ink, { width: 3 }); line(ctx, [[slitX, H / 2 - 6], [slitX, H / 2 + 6]], C.ink, { width: 3 }); line(ctx, [[slitX, H / 2 + 14], [slitX, H - 20]], C.ink, { width: 3 });
      text(ctx, `d = ${fmt(p.d)} mm`, slitX + 6, H / 2 - 22, C.ink2, { font: '11px sans-serif' });
      line(ctx, [[scrX, 20], [scrX, H - 20]], C.ink2, { width: 2 });
      arrow(ctx, slitX, H - 30, scrX, H - 30, C.ink3, { width: 1, label: '' }); text(ctx, `L = ${fmt(p.L)} m`, (slitX + scrX) / 2, H - 36, C.ink2, { align: 'center', font: '11px sans-serif' });
      const x0 = scrX + 14, w = W - x0 - 10;
      for (let j = 0; j < H - 40; j++) {
        const xmm = XMAX - 2 * XMAX * j / (H - 41), I = model.intensity(p, xmm);
        ctx.fillStyle = col; ctx.globalAlpha = I; ctx.fillRect(x0, 20 + j, w, 1.2);
      }
      ctx.globalAlpha = 1;
      text(ctx, `明線の間隔 Δx = Lλ/d = ${fmt(s.dx)} mm`, 10, 16, C.ink2);
      text(ctx, `±${XMAX} mm`, x0 + w / 2, H - 6, C.ink3, { align: 'center', font: '10px sans-serif' });
    },
  },
};
