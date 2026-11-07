// パラメータの管理：登録簿（content/simulations.json）の定義と、画面の値（度など）↔ モデルの値（SI・ラジアン）
// 単位の変換はここだけで行う。モデルの中はすべて SI。
export const FILE_VERSION = '0.3.0';

export function defaults(sim) {
  return Object.fromEntries(Object.entries(sim.params).map(([k, d]) => [k, d.default]));
}

// 画面の値 → 範囲に収め、刻みにそろえる
export function clamp(sim, key, v) {
  const d = sim.params[key];
  let x = Number(v);
  if (!Number.isFinite(x)) x = d.default;
  if (d.min != null) x = Math.max(d.min, x);
  if (d.max != null) x = Math.min(d.max, x);
  if (d.step) x = Math.round((x - (d.min ?? 0)) / d.step) * d.step + (d.min ?? 0);
  return +x.toFixed(10);
}

export function merge(sim, ...sources) {
  const out = defaults(sim);
  for (const src of sources) for (const [k, v] of Object.entries(src || {})) if (k in sim.params) out[k] = clamp(sim, k, v);
  return out;
}

// 画面の値 → モデルの値（deg → rad。それ以外はそのまま）
export function toModel(sim, values) {
  const out = {};
  for (const [k, d] of Object.entries(sim.params)) out[k] = d.unit === 'deg' ? values[k] * Math.PI / 180 : values[k];
  return out;
}
