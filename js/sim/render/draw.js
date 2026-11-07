// Canvas 描画の共通部品：高解像度対応・世界座標（m）→ 画面座標・矢印・文字・色
export const FILE_VERSION = '0.3.0';

export function colors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  return { ink: v('--ink', '#1c1d21'), ink2: v('--ink-2', '#5d6170'), ink3: v('--ink-3', '#8f93a0'), line: v('--line', '#e4e1d8'),
    card: v('--card', '#fff'), paper: v('--paper', '#f6f4ee'), accent: v('--accent', '#2f5bd3'),
    force: v('--fig-force', '#c2412f'), vel: v('--fig-vel', '#2f5bd3'), comp: v('--fig-comp', '#7a5bc7'), cur: v('--fig-cur', '#b7791f'), good: v('--good', '#1f8a52') };
}

// キャンバスを要素の大きさ × 端末の画素比に合わせる
export function fitCanvas(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: r.width, H: r.height };
}

// 世界座標の範囲を、縦横比を保って画面に収める（y は上向き）
export function viewport(W, H, b, pad = 18) {
  // 画面がまだ小さい（レイアウト前）ときも縮尺が負にならないように
  const sx = Math.max(1, W - 2 * pad) / (b.xmax - b.xmin), sy = Math.max(1, H - 2 * pad) / (b.ymax - b.ymin), s = Math.min(sx, sy);
  // stretch：縦と横を別の縮尺にする（波の変位のように、縦を拡大して見せたいとき）
  if (b.stretch) return { s: sx, sy, X: (x) => pad + (x - b.xmin) * sx, Y: (y) => H - pad - (y - b.ymin) * sy };
  const ox = pad + ((W - 2 * pad) - s * (b.xmax - b.xmin)) / 2, oy = pad + ((H - 2 * pad) - s * (b.ymax - b.ymin)) / 2;
  return { s, sy: s, X: (x) => ox + (x - b.xmin) * s, Y: (y) => H - oy - (y - b.ymin) * s };
}

export function arrow(ctx, x0, y0, x1, y1, color, { width = 2.4, dash = null, label = null, head = 9, font = 'italic 14px "Times New Roman", serif' } = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 1) return;
  const ux = dx / L, uy = dy / L, h = Math.min(head, L * 0.45);
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * h, y1 - uy * h); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * h - uy * h * 0.45, y1 - uy * h + ux * h * 0.45);
  ctx.lineTo(x1 - ux * h + uy * h * 0.45, y1 - uy * h - ux * h * 0.45);
  ctx.closePath(); ctx.fill();
  if (label) { ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x1 + ux * 13, y1 + uy * 13); }
  ctx.restore();
}

export function text(ctx, s, x, y, color, { font = '12px -apple-system, "Hiragino Sans", sans-serif', align = 'left', base = 'alphabetic' } = {}) {
  ctx.save(); ctx.fillStyle = color; ctx.font = font; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y); ctx.restore();
}

export function line(ctx, pts, color, { width = 1.5, dash = null, close = false, fill = null } = {}) {
  ctx.save(); ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash); ctx.stroke(); ctx.restore();
}

// 数値の表示（有効数字3桁。大きい・小さい数は ×10ⁿ）
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export function fmt(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
    const e = Math.floor(Math.log10(a)), m = v / 10 ** e;
    return `${m.toFixed(2)}×10${String(e).split('').map(c => SUP[c]).join('')}`;
  }
  if (a < 1e-9) return '0';
  return (+v.toPrecision(3)).toString();
}
