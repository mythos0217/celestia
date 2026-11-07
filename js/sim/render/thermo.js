// 熱の描画
import { arrow, line, text, fmt } from './draw.js';
import { V0 } from '../models/thermo/pv.js';
export const FILE_VERSION = '0.3.0';

export const THERMO = {
  'thermo.molecules': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C, model, t) {
      const W = V.W, H = V.H, size = Math.min(W * 0.6, H - 40), x0 = 14, y0 = (H - size) / 2;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, size, size);
      ctx.fillStyle = C.force; ctx.globalAlpha = 0.18; ctx.fillRect(x0 + size - 4, y0, 4, size); ctx.globalAlpha = 1;
      const vr = model.measures(p).vrms;
      for (const m of model.positions(p, t)) {
        const depth = 0.55 + 0.45 * m.z;
        ctx.beginPath(); ctx.arc(x0 + m.x * size, y0 + (1 - m.y) * size, 2.4 * depth + 0.6, 0, 2 * Math.PI);
        const u = Math.min(1, m.v / (2 * vr)); ctx.fillStyle = `rgb(${Math.round(60 + 190 * u)},${Math.round(110 - 40 * u)},${Math.round(220 - 170 * u)})`; ctx.fill();
      }
      const tx = x0 + size + 16;
      text(ctx, '右の壁にぶつかった', tx, y0 + 16, C.ink2, { font: '11px sans-serif' });
      text(ctx, '力積から測った圧力', tx, y0 + 30, C.ink2, { font: '11px sans-serif' });
      text(ctx, `${fmt(s.P)} Pa`, tx, y0 + 50, C.force, { font: 'bold 14px sans-serif' });
      text(ctx, '理論 N m⟨v²⟩/(3V)', tx, y0 + 76, C.ink2, { font: '11px sans-serif' });
      text(ctx, `${fmt(s.Pth)} Pa`, tx, y0 + 96, C.ink, { font: 'bold 14px sans-serif' });
      text(ctx, `√⟨v²⟩ = ${fmt(vr)} m/s`, tx, y0 + 122, C.ink2, { font: '11px sans-serif' });
    },
  },
  'thermo.pv': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C) {
      const W = V.W, H = V.H, cyl = { x: 30, y: 40, w: Math.min(W * 0.62, 300), h: H - 110 };
      const maxV = V0 * Math.max(3, p.ratio), len = cyl.w * s.V / maxV;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cyl.x + cyl.w + 20, cyl.y); ctx.lineTo(cyl.x, cyl.y); ctx.lineTo(cyl.x, cyl.y + cyl.h); ctx.lineTo(cyl.x + cyl.w + 20, cyl.y + cyl.h); ctx.stroke();
      const temp = Math.max(0, Math.min(1, (s.T - 100) / 800));
      ctx.fillStyle = `rgb(${Math.round(80 + 170 * temp)},${Math.round(130 - 60 * temp)},${Math.round(230 - 180 * temp)})`; ctx.globalAlpha = 0.35; ctx.fillRect(cyl.x + 2, cyl.y + 2, len, cyl.h - 4); ctx.globalAlpha = 1;
      ctx.fillStyle = C.ink2; ctx.fillRect(cyl.x + len, cyl.y + 3, 10, cyl.h - 6); line(ctx, [[cyl.x + len + 10, cyl.y + cyl.h / 2], [cyl.x + cyl.w + 40, cyl.y + cyl.h / 2]], C.ink2, { width: 4 });
      const proc = ['等温変化', '定圧変化', '定積変化', '断熱変化'][Math.round(p.proc)];
      text(ctx, proc, 10, 18, C.ink, { font: 'bold 13px sans-serif' });
      text(ctx, `T = ${fmt(s.T)} K`, cyl.x + cyl.w + 34, cyl.y + 16, C.ink, { font: '12px sans-serif' });
      text(ctx, `Q = ΔU + W：${fmt(s.Q)} = ${fmt(s.dU)} + ${fmt(s.W)} [J]`, 10, V.H - 8, C.ink2, { font: '11px sans-serif' });
      if (Math.abs(s.Q) > 1) {
        const inn = s.Q > 0, ax = cyl.x + 40, ay = cyl.y + cyl.h + 34;
        arrow(ctx, ax, inn ? ay : ay - 26, ax, inn ? ay - 26 : ay, inn ? C.force : C.vel, { label: inn ? '熱を吸収' : '熱を放出', font: '11px sans-serif' });
      }
    },
  },
};
