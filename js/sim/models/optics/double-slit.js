// ヤングの実験（二重スリット）。スクリーン上の位置 x での明るさ（強度）I = cos²(π d x / (λ L))
//   （スリット間隔 d、スクリーンまでの距離 L ≫ d、x ≪ L の近似：経路差 Δ = d x / L）
//   明線の間隔 Δx = L λ / d
// p = { lambda [nm], d [mm], L [m] }
export const FILE_VERSION = '0.3.0';
export const XMAX = 10;   // スクリーンの表示範囲 ±10 mm
export default {
  id: 'optics.double-slit',
  static: true,
  spacing({ lambda, d, L }) { return L * (lambda * 1e-9) / (d * 1e-3) * 1e3; },   // [mm]
  intensity({ lambda, d, L }, xmm) { const dx = (d * 1e-3) * (xmm * 1e-3) / L; return Math.cos(Math.PI * dx / (lambda * 1e-9)) ** 2; },
  profile(p) {
    const n = 801, x = [], I = [];
    for (let i = 0; i < n; i++) { const xi = -XMAX + 2 * XMAX * i / (n - 1); x.push(xi); I.push(this.intensity(p, xi)); }
    return { state: { dx: this.spacing(p), mark: this.spacing(p) }, obs: { x, I } };
  },
  measures(p) { return { dx: this.spacing(p) }; },
  validity(p) { return this.spacing(p) < 0.3 ? ['縞の間隔がとても狭く、見分けにくくなっています'] : []; },
};
