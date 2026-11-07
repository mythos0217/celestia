// 力学のシミュレーションの描画。モデルの状態（SI）を読んで絵にするだけで、物理の計算はしない。
// 各描画器：bounds(p, trace) → 世界座標の範囲、draw(ctx, V, state, p, trace, C) → 1コマ描く
import { arrow, line, text, fmt } from './draw.js';
import { LENGTH as INCLINE_L } from '../models/mechanics/incline.js';
import { X1, X2, W as CART_W } from '../models/mechanics/collision.js';
import { R as EARTH_R } from '../models/mechanics/gravitation.js';
export const FILE_VERSION = '0.3.0';

const range = (a) => [Math.min(...a), Math.max(...a)];
// 軌跡のうち時刻 t までの点
const upto = (trace, t, fx, fy) => { const out = []; for (let i = 0; i < trace.t.length && trace.t[i] <= t; i++) out.push([fx(trace.states[i]), fy(trace.states[i])]); return out; };

export const RENDERERS = {
  'mech.projectile': {
    bounds(p, tr) {
      const [x0, x1] = range(tr.obs.x), [, y1] = range(tr.obs.y);
      const w = Math.max(x1 - x0, 1), h = Math.max(y1, 0.5);
      return { xmin: Math.min(0, x0) - 0.08 * w - (p.h0 > 0 ? 0.12 * w : 0), xmax: x1 + 0.12 * w, ymin: -0.08 * h, ymax: h * 1.25 };
    },
    draw(ctx, V, s, p, tr, C) {
      const b = V.b;
      line(ctx, [[V.X(b.xmin), V.Y(0)], [V.X(b.xmax), V.Y(0)]], C.ink2, { width: 2 });
      if (p.h0 > 0) line(ctx, [[V.X(b.xmin), V.Y(p.h0)], [V.X(0), V.Y(p.h0)], [V.X(0), V.Y(0)]], C.ink2, { width: 2, fill: C.line });
      line(ctx, tr.states.map(q => [V.X(q.x), V.Y(q.y)]), C.ink3, { width: 1, dash: [4, 4] });
      line(ctx, upto(tr, s.t, q => V.X(q.x), q => V.Y(q.y)), C.accent, { width: 2 });
      const k = 0.2 * (b.xmax - b.xmin) / Math.max(p.v0, 1e-9) * V.s;   // 速さ → 画面の長さ
      const X = V.X(s.x), Y = V.Y(s.y);
      arrow(ctx, X, Y, X + s.vx * k, Y, C.comp, { dash: [5, 4], width: 1.8, label: 'vx' });
      arrow(ctx, X, Y, X, Y - s.vy * k, C.comp, { dash: [5, 4], width: 1.8, label: 'vy' });
      arrow(ctx, X, Y, X + s.vx * k, Y - s.vy * k, C.vel, { label: 'v' });
      ctx.beginPath(); ctx.arc(X, Y, 7, 0, 2 * Math.PI); ctx.fillStyle = C.accent; ctx.fill();
    },
  },
  'mech.incline': {
    bounds(p) {
      const H = INCLINE_L * Math.sin(p.theta), Wd = INCLINE_L * Math.cos(p.theta);
      return { xmin: -0.9, xmax: Wd + 0.6, ymin: -0.3, ymax: H + 1.3 };
    },
    draw(ctx, V, s, p, tr, C) {
      const c = Math.cos(p.theta), sn = Math.sin(p.theta), H = INCLINE_L * sn, Wd = INCLINE_L * c;
      line(ctx, [[V.X(0), V.Y(H)], [V.X(Wd), V.Y(0)], [V.X(0), V.Y(0)]], C.ink2, { width: 2, close: true, fill: C.line });
      line(ctx, [[V.X(-0.9), V.Y(0)], [V.X(Wd + 0.6), V.Y(0)]], C.ink2, { width: 2 });
      // 物体：斜面に沿って上端から s だけ下った位置（底辺の中央）
      const bw = 0.5, bh = 0.32, cx = 0.35 + s.s * (INCLINE_L - 0.7) / INCLINE_L;
      const px = cx * c, py = H - cx * sn;
      ctx.save(); ctx.translate(V.X(px), V.Y(py)); ctx.rotate(p.theta);
      ctx.fillStyle = C.card; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
      ctx.fillRect(-bw / 2 * V.s, -bh * V.s, bw * V.s, bh * V.s); ctx.strokeRect(-bw / 2 * V.s, -bh * V.s, bw * V.s, bh * V.s);
      ctx.restore();
      // 物体の中心から力の矢印（重力 mg を 1.1 m に）
      const nx = sn, ny = c;   // 斜面から外向きの法線
      const ox = V.X(px + nx * bh / 2), oy = V.Y(py + ny * bh / 2), k = 1.1 / (p.m * p.g) * V.s;
      arrow(ctx, ox, oy, ox, oy + p.m * p.g * k, C.force, { label: 'mg' });
      arrow(ctx, ox, oy, ox + s.N * nx * k, oy - s.N * ny * k, C.force, { label: 'N' });
      arrow(ctx, ox, oy, ox - s.f * c * k, oy - s.f * sn * k, C.force, { label: s.sliding ? "f'" : 'f' });
      text(ctx, s.sliding ? '滑っている（動摩擦力）' : '静止している（静止摩擦力）', 10, 18, s.sliding ? C.force : C.good, { font: 'bold 12px -apple-system, sans-serif' });
    },
  },
  'mech.spring': {
    bounds(p) { const A = Math.max(p.A, 0.05); return { xmin: -0.75, xmax: A + 0.4, ymin: -0.12, ymax: 0.3 }; },
    draw(ctx, V, s, p, tr, C) {
      const L0 = 0.6, wall = -L0, bw = 0.16, bh = 0.16;
      line(ctx, [[V.X(wall), V.Y(0.28)], [V.X(wall), V.Y(0)], [V.X(p.A + 0.4), V.Y(0)]], C.ink2, { width: 2 });
      line(ctx, [[V.X(0), V.Y(0.27)], [V.X(0), V.Y(-0.05)]], C.ink3, { width: 1, dash: [4, 4] });
      text(ctx, '自然長', V.X(0), V.Y(-0.1), C.ink3, { align: 'center' });
      // ばね：壁から物体の左端まで（x = 物体の左端の変位）
      const x0 = wall, x1 = s.x, y = bh / 2, n = 12, pts = [[V.X(x0), V.Y(y)]];
      for (let i = 1; i < 2 * n; i++) pts.push([V.X(x0 + 0.03 + (x1 - x0 - 0.06) * i / (2 * n)), V.Y(y + (i % 2 ? 0.035 : -0.035))]);
      pts.push([V.X(x1), V.Y(y)]);
      line(ctx, pts, C.ink, { width: 1.6 });
      ctx.fillStyle = C.card; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
      ctx.fillRect(V.X(x1), V.Y(bh), bw * V.s, bh * V.s); ctx.strokeRect(V.X(x1), V.Y(bh), bw * V.s, bh * V.s);
      const k = 0.18 / (p.k * Math.max(p.A, 0.01)) * V.s;
      const cx = V.X(x1 + bw / 2), cy = V.Y(bh / 2);
      arrow(ctx, cx, cy, cx - p.k * s.x * k, cy, C.force, { label: 'F = −kx' });
    },
  },
  'mech.pendulum': {
    bounds(p) { const l = p.l, top = Math.max(0.15 * l, -l * Math.cos(p.theta0) + 0.15 * l); return { xmin: -1.15 * l, xmax: 1.15 * l, ymin: -1.15 * l, ymax: top }; },
    draw(ctx, V, s, p, tr, C) {
      const l = p.l;
      line(ctx, [[V.X(-0.25 * l), V.Y(0)], [V.X(0.25 * l), V.Y(0)]], C.ink2, { width: 3 });
      line(ctx, [[V.X(0), V.Y(0)], [V.X(0), V.Y(-l * 1.08)]], C.ink3, { width: 1, dash: [4, 4] });
      ctx.save(); ctx.beginPath(); ctx.strokeStyle = C.ink3; ctx.setLineDash([2, 4]);
      ctx.arc(V.X(0), V.Y(0), l * V.s, Math.PI / 2 - p.theta0, Math.PI / 2 + p.theta0); ctx.stroke(); ctx.restore();
      line(ctx, [[V.X(0), V.Y(0)], [V.X(s.x), V.Y(s.y)]], C.ink, { width: 1.5 });
      const X = V.X(s.x), Y = V.Y(s.y);
      // 重力の接線成分（振動の中心向きの復元力）
      const k = 0.35 * l * V.s, ft = -Math.sin(s.theta);
      arrow(ctx, X, Y, X + ft * Math.cos(s.theta) * k, Y - ft * Math.sin(s.theta) * k, C.force, { label: 'mg sinθ' });
      ctx.beginPath(); ctx.arc(X, Y, 10, 0, 2 * Math.PI); ctx.fillStyle = C.accent; ctx.fill();
      text(ctx, `θ = ${(s.theta * 180 / Math.PI).toFixed(1)}°`, 10, 18, C.ink2);
    },
  },
  'mech.collision': {
    bounds() { return { xmin: -2.4, xmax: 2.4, ymin: -0.3, ymax: 0.85 }; },
    draw(ctx, V, s, p, tr, C) {
      line(ctx, [[V.X(-2.4), V.Y(0)], [V.X(2.4), V.Y(0)]], C.ink2, { width: 2 });
      const h = 0.3, k = 0.16 * V.s;
      for (const [x, v, m, name, col] of [[s.x1, s.v1, p.m1, '1', C.accent], [s.x2, s.v2, p.m2, '2', C.force]]) {
        const hh = h * (0.7 + 0.3 * Math.min(2, Math.sqrt(m)) / 1.4);
        ctx.fillStyle = C.card; ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.fillRect(V.X(x - CART_W / 2), V.Y(hh), CART_W * V.s, hh * V.s); ctx.strokeRect(V.X(x - CART_W / 2), V.Y(hh), CART_W * V.s, hh * V.s);
        text(ctx, `${name}（${fmt(m)} kg）`, V.X(x), V.Y(hh / 2), col, { align: 'center', base: 'middle', font: 'bold 11px -apple-system, sans-serif' });
        if (Math.abs(v) > 1e-9) arrow(ctx, V.X(x), V.Y(hh + 0.18), V.X(x) + v * k, V.Y(hh + 0.18), col, { label: `${fmt(v)} m/s`, font: '12px -apple-system, sans-serif' });
      }
      text(ctx, s.hit ? '衝突後' : '衝突前', 10, 18, C.ink2, { font: 'bold 12px -apple-system, sans-serif' });
    },
  },
  'mech.circular': {
    bounds(p) { const r = p.r * 1.45; return { xmin: -r, xmax: r, ymin: -r, ymax: r }; },
    draw(ctx, V, s, p, tr, C) {
      ctx.save(); ctx.beginPath(); ctx.strokeStyle = C.ink3; ctx.setLineDash([4, 4]); ctx.arc(V.X(0), V.Y(0), p.r * V.s, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), 3, 0, 2 * Math.PI); ctx.fillStyle = C.ink; ctx.fill();
      line(ctx, [[V.X(0), V.Y(0)], [V.X(s.x), V.Y(s.y)]], C.ink3, { width: 1 });
      const X = V.X(s.x), Y = V.Y(s.y), kv = 0.4 * p.r / p.v * V.s, ka = 0.4 * p.r / (p.v * p.v / p.r) * V.s;
      arrow(ctx, X, Y, X + s.vx * kv, Y - s.vy * kv, C.vel, { label: 'v' });
      arrow(ctx, X, Y, X + s.ax * ka, Y - s.ay * ka, C.force, { label: 'a' });
      ctx.beginPath(); ctx.arc(X, Y, 8, 0, 2 * Math.PI); ctx.fillStyle = C.accent; ctx.fill();
    },
  },
  'mech.gravitation': {
    bounds(p, tr) {
      const m = Math.max(...tr.obs.x.map(Math.abs), ...tr.obs.y.map(Math.abs), EARTH_R) * 1.12;
      return { xmin: -m, xmax: m, ymin: -m, ymax: m };
    },
    draw(ctx, V, s, p, tr, C) {
      ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), EARTH_R * V.s, 0, 2 * Math.PI); ctx.fillStyle = '#3f7fd6'; ctx.fill();
      text(ctx, '地球', V.X(0), V.Y(0), '#fff', { align: 'center', base: 'middle', font: 'bold 12px -apple-system, sans-serif' });
      line(ctx, tr.states.map(q => [V.X(q.x), V.Y(q.y)]), C.ink3, { width: 1, dash: [3, 4] });
      line(ctx, upto(tr, s.t, q => V.X(q.x), q => V.Y(q.y)), C.accent, { width: 1.8 });
      const X = V.X(s.x), Y = V.Y(s.y), v0 = Math.hypot(tr.states[0].vx, tr.states[0].vy), k = 0.25 * (V.b.xmax - V.b.xmin) / v0 * V.s * 0.5;
      arrow(ctx, X, Y, X + s.vx * k, Y - s.vy * k, C.vel, { label: 'v' });
      const r = Math.hypot(s.x, s.y), ka = 0.12 * (V.b.xmax - V.b.xmin) * V.s / r;
      arrow(ctx, X, Y, X - s.x * ka, Y + s.y * ka, C.force, { label: 'F' });
      ctx.beginPath(); ctx.arc(X, Y, 6, 0, 2 * Math.PI); ctx.fillStyle = C.ink; ctx.fill();
      text(ctx, `高さ ${fmt((r - EARTH_R) / 1000)} km`, 10, 18, C.ink2);
    },
  },
};
