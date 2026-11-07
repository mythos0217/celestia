// 万有引力による人工衛星の運動（地球を固定、衛星 1 kg）。速度ベルレで積分する。
//   GM = g R²（地表の重力加速度 g = 9.8 m/s²、地球の半径 R = 6.37×10⁶ m）
//   初め：中心から r0 R の点で、動径に垂直に速さ vratio × √(GM / r)（vratio = 1 で円軌道、√2 以上で脱出）
// p = { r0, vratio }。状態 = [x, y, vx, vy]
import { measurePeriod } from '../../core/trace.js';
export const FILE_VERSION = '0.3.0';
export const R = 6.37e6, G0 = 9.8, GM = G0 * R * R;
export default {
  id: 'mech.gravitation',
  integrator: 'verlet',
  endName: '地表に到達',
  Tcirc({ r0 }) { const r = r0 * R; return 2 * Math.PI * Math.sqrt(r ** 3 / GM); },
  dt(p) { return this.Tcirc(p) / 20000; },
  sample(p) { return this.Tcirc(p) / 1500; },
  playRate(p) { return this.Tcirc(p) / 8; },   // 円軌道の1周を8秒で見せる（実際は数時間）
  duration(p) {
    const r = p.r0 * R, v = p.vratio * Math.sqrt(GM / r), E = 0.5 * v * v - GM / r;
    if (E >= 0) return 2 * this.Tcirc(p);
    const a = -GM / (2 * E);   // 楕円の長半径
    return 2 * 2 * Math.PI * Math.sqrt(a ** 3 / GM);
  },
  init(p) { const r = p.r0 * R; return [r, 0, 0, p.vratio * Math.sqrt(GM / r)]; },
  accel([x, y]) { const r3 = Math.hypot(x, y) ** 3; return [-GM * x / r3, -GM * y / r3]; },
  event([x, y]) { return Math.hypot(x, y) - R; },
  state([x, y, vx, vy], p, t) {
    const r = Math.hypot(x, y);
    return { t, x, y, vx, vy, r, v: Math.hypot(vx, vy), E: 0.5 * (vx * vx + vy * vy) - GM / r, L: x * vy - y * vx };
  },
  measures(p) {
    const r = p.r0 * R, v = p.vratio * Math.sqrt(GM / r), E = 0.5 * v * v - GM / r;
    return { vcirc: Math.sqrt(GM / r), vesc: Math.sqrt(2 * GM / r), bound: E < 0 ? 1 : 0, Tcirc: this.Tcirc(p) };
  },
  // 軌跡から測る量
  measureTrace(trace) { return { period: measurePeriod(trace, 'x') }; },
  validity(p) {
    const w = [];
    if (p.vratio >= Math.SQRT2 - 1e-9) w.push('円軌道の速さの √2 倍以上なので、地球の重力を振り切って遠ざかります（第2宇宙速度）');
    return w;
  },
};
