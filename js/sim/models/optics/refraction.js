// 光の屈折と全反射（境界面は水平、光は上の媒質1から入射）。屈折の法則 n1 sinθ1 = n2 sinθ2
//   n1 > n2 で sinθ1 > n2/n1 なら屈折光はなく、全反射（臨界角 θc：sinθc = n2/n1）
// 時間によらないので、角度ごとの関係（θ2-θ1 の曲線）を分布として出す
// p = { n1, n2, theta1 [rad] }
export const FILE_VERSION = '0.3.0';
const DEG = 180 / Math.PI;
export function refract(n1, n2, th1) { const s = n1 * Math.sin(th1) / n2; return s <= 1 ? Math.asin(s) : null; }
export default {
  id: 'optics.refraction',
  static: true,
  profile(p) {
    const th2 = refract(p.n1, p.n2, p.theta1);
    const crit = p.n1 > p.n2 ? Math.asin(p.n2 / p.n1) : null;
    const xs = [], ys = [];
    for (let i = 0; i <= 180; i++) {
      const a = (89.9 * i / 180) / DEG, b = refract(p.n1, p.n2, a);
      if (b == null) break;
      xs.push(a * DEG); ys.push(b * DEG);
    }
    return { state: { th1: p.theta1 * DEG, th2: th2 == null ? null : th2 * DEG, crit: crit == null ? null : crit * DEG, total: th2 == null ? 1 : 0, mark: p.theta1 * DEG },
      obs: { th1: xs, th2: ys } };
  },
  measures(p) {
    const th2 = refract(p.n1, p.n2, p.theta1);
    return { th2: th2 == null ? null : th2 * DEG, crit: p.n1 > p.n2 ? Math.asin(p.n2 / p.n1) * DEG : null, nrel: p.n2 / p.n1 };
  },
  validity(p) { return refract(p.n1, p.n2, p.theta1) == null ? ['入射角が臨界角より大きいので、全反射が起きています（屈折光はない）'] : []; },
};
