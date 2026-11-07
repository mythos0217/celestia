// 原子の描画
import { arrow, line, text, fmt } from './draw.js';
import { waveColor } from './optics.js';
export const FILE_VERSION = '0.3.0';

export const ATOMIC = {
  'atom.photoelectric': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C, model) {
      const W = V.W, H = V.H, lam = 3e8 / (p.f * 1e14) * 1e9;
      const col = lam >= 380 && lam <= 780 ? waveColor(lam) : (lam < 380 ? '#8a6bd8' : '#b0453a');
      const kx = W * 0.25, ax = W * 0.72, top = H * 0.25, bot = H * 0.75;
      ctx.fillStyle = C.ink2; ctx.fillRect(kx - 6, top, 12, bot - top); ctx.fillRect(ax - 4, top, 8, bot - top);
      text(ctx, '陰極（金属）', kx, bot + 18, C.ink2, { align: 'center', font: '11px sans-serif' }); text(ctx, '陽極', ax, bot + 18, C.ink2, { align: 'center', font: '11px sans-serif' });
      for (let i = 0; i < 1 + Math.round(5 * p.I); i++) { const y = top + 14 + i * 14; arrow(ctx, 14, y - 20, kx - 8, y, col, { width: 2 }); }
      text(ctx, `${lam >= 380 && lam <= 780 ? '可視光' : lam < 380 ? '紫外線' : '赤外線'} λ = ${fmt(lam)} nm`, 10, 16, C.ink2, { font: '11px sans-serif' });
      if (s.emit) {
        const n = Math.round(3 + 6 * p.I), reach = s.Icur / Math.max(p.I, 1e-9);
        for (let i = 0; i < n; i++) { const y = top + 10 + (bot - top - 20) * i / Math.max(1, n - 1), go = i / n < reach; arrow(ctx, kx + 8, y, go ? ax - 8 : kx + 8 + (ax - kx) * 0.45, y, go ? C.accent : C.ink3, { width: 1.4, head: 6 }); }
        text(ctx, `飛び出す電子の運動エネルギーの最大値 K₀ = ${fmt(s.K0)} eV`, 10, H - 10, C.accent, { font: '12px sans-serif' });
      } else text(ctx, '電子は飛び出さない（hf < W）', 10, H - 10, C.force, { font: 'bold 12px sans-serif' });
      text(ctx, `陽極の電位 V = ${fmt(p.V)} V`, ax - 20, top - 10, C.ink2, { align: 'center', font: '11px sans-serif' });
    },
  },
  'atom.decay': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C, model, t) {
      const W = V.W, H = V.H, ts = model.times(p), n = ts.length, cols = Math.ceil(Math.sqrt(n * (W - 20) / (H - 40))), rows = Math.ceil(n / cols);
      const cell = Math.min((W - 20) / cols, (H - 40) / rows), r = Math.max(1.2, cell * 0.35);
      ts.forEach((td, i) => {
        const x = 10 + (i % cols + 0.5) * cell, y = 30 + (Math.floor(i / cols) + 0.5) * cell;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = td > t ? C.force : C.line; ctx.fill();
      });
      text(ctx, `残っている原子核 ${s.N} 個（期待値 ${fmt(s.Nth)}）　経過 ${fmt(t / p.T)} 半減期`, 10, 18, C.ink2);
    },
  },
};
