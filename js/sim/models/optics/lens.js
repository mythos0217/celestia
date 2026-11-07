// 薄いレンズによる像。レンズの式 1/a + 1/b = 1/f（a：物体の距離、b > 0 なら実像（反対側）、b < 0 なら虚像（同じ側））
//   f > 0：凸レンズ、f < 0：凹レンズ。倍率 m = |b| / a、像の高さ h' = −(b / a) h（負なら倒立）
// p = { f [m], a [m], h [m] }
export const FILE_VERSION = '0.3.0';
export default {
  id: 'optics.lens',
  static: true,
  image({ f, a }) { return Math.abs(a - f) < 1e-9 ? Infinity : a * f / (a - f); },
  profile(p) {
    const b = this.image(p);
    const xs = [], ys = [];
    for (let i = 1; i <= 300; i++) {
      const a = 0.05 + 5.95 * i / 300; const bb = this.image({ f: p.f, a });
      if (Math.abs(bb) < 12) { xs.push(a); ys.push(bb); } else { xs.push(a); ys.push(Math.sign(bb) * 12); }
    }
    return { state: { a: p.a, b, h2: Number.isFinite(b) ? -(b / p.a) * p.h : null, m: Number.isFinite(b) ? Math.abs(b) / p.a : null, real: b > 0 ? 1 : 0, mark: p.a },
      obs: { a: xs, b: ys } };
  },
  measures(p) { const b = this.image(p); return { b: Number.isFinite(b) ? b : null, m: Number.isFinite(b) ? Math.abs(b) / p.a : null }; },
  validity(p) {
    const b = this.image(p);
    if (!Number.isFinite(b)) return ['物体が焦点の位置にあるので、光は平行になり像はできません'];
    if (b < 0) return [p.f > 0 ? '物体が焦点より内側なので、正立の虚像（虫めがね）になります' : '凹レンズの像は、いつも正立の虚像です'];
    return [];
  },
};
