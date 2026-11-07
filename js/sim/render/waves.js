// 波動の描画
import { arrow, line, text, fmt } from './draw.js';
import { XMAX } from '../models/waves/traveling.js';
import { D as DOP_D } from '../models/waves/doppler.js';   // 観測者のはじめの位置
import { W as IW, H as IH, SCREEN_Y } from '../models/waves/interference.js';
export const FILE_VERSION = '0.3.0';

export const WAVES = {
  'wave.traveling': {
    bounds(p) { const a = 0.55 * 1.5; return { xmin: -0.3, xmax: XMAX + 0.3, ymin: -a, ymax: a, stretch: true }; },   // 縦は振幅の最大 0.5 m に合わせて固定（振幅を変えると大きさが変わって見える）
    draw(ctx, V, s, p, tr, C, model, t) {
      line(ctx, [[V.X(0), V.Y(0)], [V.X(XMAX), V.Y(0)]], C.line, { width: 1 });
      const sn = model.snapshot(p, t);
      line(ctx, sn.x.map((x, i) => [V.X(x), V.Y(sn.y[i])]), C.ink3, { width: 1 });
      // 媒質の点（上下にしか動かない）
      for (let x = 0; x <= XMAX + 1e-9; x += XMAX / 32) {
        const y = model.y(p, x, t);
        ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), 3.2, 0, 2 * Math.PI); ctx.fillStyle = C.ink2; ctx.fill();
      }
      const yP = s.yP;
      ctx.beginPath(); ctx.arc(V.X(p.xP), V.Y(yP), 6.5, 0, 2 * Math.PI); ctx.fillStyle = C.force; ctx.fill();
      text(ctx, 'P', V.X(p.xP) + 8, V.Y(yP) - 8, C.force, { font: 'bold 13px serif' });
      arrow(ctx, V.X(p.xP), V.Y(yP), V.X(p.xP), V.Y(yP) - s.vP / (2 * Math.PI * p.f) * 0.8 * V.sy, C.vel, { width: 2, label: 'v' });
      // 山の1つ（波形が進む速さ fλ で動く）
      const xc = s.crest;
      ctx.beginPath(); ctx.arc(V.X(xc), V.Y(p.A), 5, 0, 2 * Math.PI); ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
      const dir = Math.sign(p.dir || 1);
      arrow(ctx, V.X(xc), V.Y(p.A) - 14, V.X(xc) + dir * 36, V.Y(p.A) - 14, C.accent, { width: 1.8, label: '山が進む', font: '11px sans-serif' });
      text(ctx, `v = fλ = ${fmt(p.f * p.lambda)} m/s`, 10, 18, C.ink2);
    },
  },
  'wave.standing': {
    bounds(p) { const a = 0.22; return { xmin: -0.08 * p.L, xmax: p.L * 1.08, ymin: -a * 1.3, ymax: a * 1.3, stretch: true }; },
    draw(ctx, V, s, p, tr, C, model, t) {
      const sn = model.snapshot(p, t);
      line(ctx, [[V.X(0), V.Y(0)], [V.X(p.L), V.Y(0)]], C.line, { width: 1 });
      line(ctx, sn.x.map((x, i) => [V.X(x), V.Y(sn.y1[i])]), C.comp, { width: 1.2, dash: [5, 4] });
      line(ctx, sn.x.map((x, i) => [V.X(x), V.Y(sn.y2[i])]), C.cur, { width: 1.2, dash: [5, 4] });
      line(ctx, sn.x.map((x, i) => [V.X(x), V.Y(sn.y[i])]), C.accent, { width: 2.6 });
      for (const xn of model.nodes(p)) { ctx.beginPath(); ctx.arc(V.X(xn), V.Y(0), 4, 0, 2 * Math.PI); ctx.fillStyle = C.force; ctx.fill(); }
      for (const x of [0, p.L]) line(ctx, [[V.X(x), V.Y(-0.2)], [V.X(x), V.Y(0.2)]], C.ink2, { width: 3 });
      text(ctx, `${p.n} 倍振動　f = ${fmt(model.freq(p))} Hz　λ = ${fmt(model.lam(p))} m（赤い点が節）`, 10, 18, C.ink2);
      text(ctx, '点線：右向き・左向きに進む波　太線：重ね合わせ', 10, 34, C.ink3, { font: '11px sans-serif' });
    },
  },
  'wave.beats': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C, model, t) {
      const W = V.W, H = V.H;
      // 最近の 2 秒分の波形を流す
      const win = 2, pts = [], env = [];
      for (let i = 0; i <= 400; i++) { const tt = t - win + win * i / 400; if (tt < 0) continue; const st = model.at(p, tt); pts.push([20 + (W - 40) * i / 400, H / 2 - st.y * (H * 0.2) / Math.max(p.A, 1e-9)]); env.push([20 + (W - 40) * i / 400, H / 2 - st.env * (H * 0.2) / Math.max(p.A, 1e-9)]); }
      line(ctx, [[20, H / 2], [W - 20, H / 2]], C.line, { width: 1 });
      line(ctx, env, C.force, { width: 1, dash: [4, 4] });
      line(ctx, env.map(([x, y]) => [x, H - y]), C.force, { width: 1, dash: [4, 4] });
      line(ctx, pts, C.accent, { width: 1.6 });
      // 音の大きさ（包絡線）を円の大きさで
      const r = 8 + 26 * s.env / (2 * Math.max(p.A, 1e-9));
      ctx.beginPath(); ctx.arc(W - 48, 46, r, 0, 2 * Math.PI); ctx.fillStyle = C.accent; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
      text(ctx, '大きさ', W - 48, 92, C.ink3, { align: 'center', font: '11px sans-serif' });
      text(ctx, `うなり ${fmt(Math.abs(p.f1 - p.f2))} 回/秒`, 10, 18, C.ink2);
    },
  },
  'wave.doppler': {
    bounds(p, tr) { const lo = Math.min(-100, ...tr.obs.xs) - 60, hi = Math.max(DOP_D + 200, ...tr.obs.xo) + 80, h = (hi - lo) * 0.38; return { xmin: lo, xmax: hi, ymin: -h, ymax: h }; },
    draw(ctx, V, s, p, tr, C, model, t) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, V.W, V.H); ctx.clip();
      for (const f of model.fronts(p, t)) { if (!(f.r > 0)) continue; ctx.beginPath(); ctx.arc(V.X(f.x), V.Y(0), f.r * V.s, 0, 2 * Math.PI); ctx.strokeStyle = C.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.restore();
      line(ctx, [[V.X(V.b.xmin), V.Y(0)], [V.X(V.b.xmax), V.Y(0)]], C.line, { width: 1 });
      ctx.beginPath(); ctx.arc(V.X(s.xs), V.Y(0), 8, 0, 2 * Math.PI); ctx.fillStyle = C.force; ctx.fill();
      text(ctx, '音源', V.X(s.xs), V.Y(0) + 24, C.force, { align: 'center' });
      if (Math.abs(p.vs) > 1e-9) arrow(ctx, V.X(s.xs), V.Y(0) - 16, V.X(s.xs) + Math.sign(p.vs) * 30, V.Y(0) - 16, C.force, { width: 1.6 });
      ctx.fillStyle = C.ink; ctx.fillRect(V.X(s.xo) - 6, V.Y(0) - 12, 12, 24);
      text(ctx, '観測者', V.X(s.xo), V.Y(0) + 26, C.ink, { align: 'center' });
      if (Math.abs(p.vo) > 1e-9) arrow(ctx, V.X(s.xo), V.Y(0) - 20, V.X(s.xo) + Math.sign(p.vo) * 30, V.Y(0) - 20, C.ink, { width: 1.6 });
      text(ctx, `聞こえる振動数 f' = ${fmt(model.measures(p).fo)} Hz（音源は ${fmt(p.f)} Hz）`, 10, 18, C.ink2);
    },
  },
  'wave.interference': {
    bounds() { return { xmin: -IW / 2, xmax: IW / 2, ymin: 0, ymax: IH }; },
    draw(ctx, V, s, p, tr, C, model, t) {
      // 水面の変位を色で（粗い格子で計算して拡大）
      const nx = 120, ny = Math.round(nx * IH / IW), img = ctx.createImageData(nx, ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = -IW / 2 + IW * (i + 0.5) / nx, y = IH - IH * (j + 0.5) / ny, v = model.field(p, x, y, t) / 2;
        const k = 4 * (j * nx + i), c = Math.round(128 + 110 * v);
        img.data[k] = 40; img.data[k + 1] = Math.round(90 + 60 * v); img.data[k + 2] = c + 60 > 255 ? 255 : c + 60; img.data[k + 3] = 255;
      }
      const tmp = document.createElement('canvas'); tmp.width = nx; tmp.height = ny; tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, V.X(-IW / 2), V.Y(IH), IW * V.s, IH * V.s);
      for (const [x, y] of model.sources(p)) { ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), 5, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill(); }
      line(ctx, [[V.X(-IW / 2), V.Y(SCREEN_Y)], [V.X(IW / 2), V.Y(SCREEN_Y)]], '#ffffff', { width: 1, dash: [4, 4] });
      text(ctx, '点線上の振幅を下のグラフに', 10, 18, '#ffffff');
    },
  },
};
