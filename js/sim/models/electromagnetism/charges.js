// 2つの点電荷のつくる電場と電位（真空中、クーロンの法則の比例定数 k = 9.0×10⁹ N·m²/C²）
//   電場 E = Σ k q / r² （各電荷から外向き/内向き）、電位 V = Σ k q / r
// 時間によらない。x 軸（2つの電荷を結ぶ直線）上の電位と電場の x 成分を分布として出す
// p = { q1 [nC], q2 [nC], d [m] }（電荷は x = ∓d/2 に置く）
export const FILE_VERSION = '0.3.0';
export const K = 9.0e9;
export default {
  id: 'elm.charges',
  static: true,
  charges(p) { return [{ x: -p.d / 2, y: 0, q: p.q1 * 1e-9 }, { x: p.d / 2, y: 0, q: p.q2 * 1e-9 }]; },
  E(p, x, y) {
    let ex = 0, ey = 0;
    for (const c of this.charges(p)) { const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2); if (r < 1e-9) continue; const e = K * c.q / r2; ex += e * dx / r; ey += e * dy / r; }
    return [ex, ey];
  },
  V(p, x, y) { let v = 0; for (const c of this.charges(p)) { const r = Math.hypot(x - c.x, y - c.y); if (r > 1e-9) v += K * c.q / r; } return v; },
  profile(p) {
    const n = 401, xs = [], Vs = [], Es = [], L = 1.5 * p.d;
    for (let i = 0; i < n; i++) {
      const x = -L + 2 * L * i / (n - 1);
      // 電荷のすぐそばは発散するので、近すぎる点は飛ばす
      if (this.charges(p).some(c => Math.abs(x - c.x) < 0.04 * p.d)) continue;
      xs.push(x); Vs.push(this.V(p, x, 0)); Es.push(this.E(p, x, 0)[0]);
    }
    return { state: { V0: this.V(p, 0, 0), E0: this.E(p, 0, 0)[0] }, obs: { x: xs, V: Vs, Ex: Es } };
  },
  measures(p) { return { V0: this.V(p, 0, 0), E0: this.E(p, 0, 0)[0] }; },
  validity() { return []; },
};
