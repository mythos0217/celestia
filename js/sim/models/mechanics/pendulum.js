// 単振り子。微小振動の近似をせず、θ'' = −(g/l) sinθ を速度ベルレで積分する
// （振れ角が大きいと周期が 2π√(l/g) より長くなることを確かめられる）
// p = { l [m], theta0 [rad], g [m/s²] }。状態 = [θ, ω]
import { measurePeriod } from '../../core/trace.js';
export const FILE_VERSION = '0.3.0';
export default {
  id: 'mech.pendulum',
  integrator: 'verlet',
  T0({ l, g }) { return 2 * Math.PI * Math.sqrt(l / g); },
  dt(p) { return this.T0(p) / 4000; },
  duration(p) { return Math.min(40, 3 * this.T0(p) * (1 + p.theta0 * p.theta0 / 8) + 0.01); },
  init(p) { return [p.theta0, 0]; },
  accel([th], { l, g }) { return [-(g / l) * Math.sin(th)]; },
  state([th, w], { l, g }, t) {
    return { t, theta: th, omega: w, x: l * Math.sin(th), y: -l * Math.cos(th), E: 0.5 * l * l * w * w + g * l * (1 - Math.cos(th)) };
  },
  measures(p) { return { T0: this.T0(p) }; },
  // 軌跡から測る量
  measureTrace(trace) { return { period: measurePeriod(trace, 'omega') }; },
  validity(p) { return p.theta0 > 0.35 ? ['振れ角が大きいので、周期は 2π√(l/g) より長くなります（微小振動の近似が成り立たない）'] : []; },
};
