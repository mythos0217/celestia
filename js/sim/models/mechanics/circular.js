// 等速円運動（反時計回り）。解析解：x = r cos ωt、y = r sin ωt、ω = v / r。加速度は中心向きで大きさ v²/r
// p = { r [m], v [m/s] }
export const FILE_VERSION = '0.3.0';
export default {
  id: 'mech.circular',
  integrator: 'analytic',
  duration({ r, v }) { return Math.min(30, 2 * 2 * Math.PI * r / v); },
  at({ r, v }, t) {
    const w = v / r, c = Math.cos(w * t), s = Math.sin(w * t);
    return { t, x: r * c, y: r * s, vx: -v * s, vy: v * c, ax: -w * w * r * c, ay: -w * w * r * s, phi: w * t };
  },
  measures({ r, v }) { return { period: 2 * Math.PI * r / v, omega: v / r, acc: v * v / r }; },
  validity() { return []; },
};
