// 斜方投射・水平投射（空気抵抗なし）。解析解：x = v0 cosθ t、y = h0 + v0 sinθ t − g t²/2
// p = { v0 [m/s], theta [rad], h0 [m], g [m/s²] }
export const FILE_VERSION = '0.3.0';
export default {
  id: 'mech.projectile',
  integrator: 'analytic',
  endName: '着地',
  // 着地の時刻：h0 + v0 sinθ t − g t²/2 = 0 の正の解
  endTime({ v0, theta, h0, g }) {
    const vy = v0 * Math.sin(theta);
    if (h0 <= 0 && vy <= 0) return 0;
    return (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  },
  duration(p) { return Math.max(0.5, this.endTime(p)); },
  at({ v0, theta, h0, g }, t) {
    const vx = v0 * Math.cos(theta), vy0 = v0 * Math.sin(theta);
    return { t, x: vx * t, y: h0 + vy0 * t - 0.5 * g * t * t, vx, vy: vy0 - g * t };
  },
  measures(p) {
    const T = this.endTime(p), vy = p.v0 * Math.sin(p.theta);
    return { range: p.v0 * Math.cos(p.theta) * T, maxHeight: p.h0 + (vy > 0 ? vy * vy / (2 * p.g) : 0), flightTime: T };
  },
  validity() { return []; },
};
