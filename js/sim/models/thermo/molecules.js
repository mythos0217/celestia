// 気体分子運動論（3次元の立方体の容器、分子どうしは衝突しない理想気体）。
// 各分子は壁で弾性的にはね返る。右の壁（x = L）が受けた力積を数えて圧力を「測る」：
//   P測 = Σ(2 m |vx| × 衝突回数) / (t L²)。理論：P = N m ⟨v²⟩ / (3V) = N k T / V
// 分子の速度は温度 T のマクスウェル分布から（決まった乱数の種で）選ぶ。ヘリウム（m = 6.64×10⁻²⁷ kg）
// 位置は「折り返し」で正確に求める（数値積分の誤差なし）
// p = { N（分子数）, T [K], L [mm] }
export const FILE_VERSION = '0.3.0';
export const KB = 1.38e-23, MHE = 6.64e-27;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const fold = (u, L) => { const m = ((u % (2 * L)) + 2 * L) % (2 * L); return m <= L ? m : 2 * L - m; };
// 開区間 (a, b] にある奇数の個数（壁 x = L の像は L の奇数倍）
const odd = (a, b) => Math.floor((b - 1) / 2) - Math.floor((a - 1) / 2);
const cache = new Map();
export default {
  id: 'thermo.molecules',
  integrator: 'analytic',
  gas(p) {
    const key = `${p.N}|${p.T}|${p.L}`;
    if (cache.has(key)) return cache.get(key);
    const r = rng(12345), L = p.L * 1e-3, s = Math.sqrt(KB * p.T / MHE), out = [];
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    for (let i = 0; i < p.N; i++) out.push({ x: r() * L, y: r() * L, z: r() * L, vx: s * gauss(), vy: s * gauss(), vz: s * gauss() });
    if (cache.size > 20) cache.clear();
    cache.set(key, out);
    return out;
  },
  v2mean(p) { const g = this.gas(p); return g.reduce((a, m) => a + m.vx ** 2 + m.vy ** 2 + m.vz ** 2, 0) / g.length; },
  Pth(p) { const V = (p.L * 1e-3) ** 3; return p.N * MHE * this.v2mean(p) / (3 * V); },
  duration(p) { return 60 * (p.L * 1e-3) / Math.sqrt(3 * KB * p.T / MHE); },   // 平均で約 30 往復
  sample(p) { return this.duration(p) / 600; },
  playRate(p) { return this.duration(p) / 15; },
  at(p, t) {
    const L = p.L * 1e-3, g = this.gas(p);
    let imp = 0;
    for (const m of g) { const u0 = m.x / L, u1 = (m.x + m.vx * t) / L; const n = m.vx > 0 ? odd(u0, u1) : odd(u1, u0); imp += 2 * MHE * Math.abs(m.vx) * Math.max(0, n); }
    const P = t > 0 ? imp / (t * L * L) : 0;
    return { t, P, Pth: this.Pth(p) };
  },
  positions(p, t) { const L = p.L * 1e-3; return this.gas(p).map(m => ({ x: fold(m.x + m.vx * t, L) / L, y: fold(m.y + m.vy * t, L) / L, z: fold(m.z + m.vz * t, L) / L, v: Math.hypot(m.vx, m.vy, m.vz) })); },
  measures(p) { return { vrms: Math.sqrt(this.v2mean(p)), Pth: this.Pth(p), Tgas: MHE * this.v2mean(p) / (3 * KB) }; },
  validity(p) { return p.N < 30 ? ['分子が少ないと、測った圧力のゆらぎが大きくなります'] : []; },
};
