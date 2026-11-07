// シミュレーションのプレーヤー（全シミュレーション共通の画面部品）
//   現象のアニメーション・パラメータ・再生の操作・測定値・連動グラフを1つにまとめる。
//   パラメータを変えると軌跡（trace）を作り直し、アニメーションとグラフは同じ軌跡から描く。
import { buildTrace, stateAt } from '../core/trace.js';
import { merge, toModel, clamp } from '../core/params.js';
import { Clock } from '../core/clock.js';
import { TimePlot } from '../plot/timeplot.js';
import { RENDERERS } from '../render/index.js';
import { fitCanvas, viewport, colors, fmt } from '../render/draw.js';
export const FILE_VERSION = '0.3.0';

// 登録簿のグラフの指定 → TimePlot の段。[x, y] または { x, y | ys: [..], labels, snap, mark, zero, yRange }
export function plotSeries(sim, spec) {
  const o = Array.isArray(spec) ? { x: spec[0], y: spec[1] } : spec;
  const keys = o.ys || [o.y], lab = (k) => (sim.labels || {})[k] || k;
  return { key: keys[0], keys, x: o.x, label: o.label || lab(keys[0]), labels: keys.map(lab), unit: unitText(sim.observables[keys[0]]),
    xLabel: lab(o.x), xUnit: o.x === 't' ? 's' : unitText(sim.observables[o.x]), snap: !!o.snap, mark: o.mark, zero: !!o.zero, yRange: o.yRange, height: o.height };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const models = new Map();
export async function loadModel(sim) {
  if (!models.has(sim.model)) models.set(sim.model, import(`../models/${sim.model}.js`).then(m => m.default));
  return models.get(sim.model);
}
const unitText = (u) => (!u || u === '1') ? '' : u === 'deg' ? '°' : u.replace('^2', '²').replace('^3', '³').replace('*', '·');

// host に置く。opts: { values: 初めの値（画面の単位）, locked: [変えられないパラメータ], plots: 出すグラフの数, compact, onChange(values) }
export async function mountPlayer(host, sim, { values = {}, locked = [], maxPlots = 4, compact = false, onChange = () => {} } = {}) {
  const model = await loadModel(sim);
  const R = RENDERERS[sim.id];
  let vals = merge(sim, values), trace = null, view = null, p = null;
  const plots = sim.plots.slice(0, maxPlots);
  host.classList.add('sim-player');
  if (compact) host.classList.add('compact');
  host.innerHTML = `
    <div class="sp-stage"><canvas class="sp-canvas" role="img" aria-label="${esc(sim.name)}のアニメーション"></canvas></div>
    <div class="sp-bar">
      <button class="sp-btn sp-play" aria-label="再生">▶</button>
      <button class="sp-btn sp-reset" aria-label="最初に戻す">↺</button>
      <input class="sp-seek" type="range" min="0" max="1000" value="0" aria-label="時刻">
      <span class="sp-time">0.00 s</span>
      <select class="sp-speed" aria-label="再生速度">${[0.25, 0.5, 1, 2, 4].map(x => `<option value="${x}" ${x === 1 ? 'selected' : ''}>${x}倍</option>`).join('')}</select>
    </div>
    <div class="sp-warn" hidden></div>
    <div class="sp-cols">
      <div class="sp-params">${Object.entries(sim.params).map(([k, d]) => `
        <label class="sp-param ${locked.includes(k) ? 'locked' : ''}">
          <span class="sp-pl">${esc(d.label)} <b data-v="${esc(k)}"></b>${locked.includes(k) ? '<i>固定</i>' : ''}</span>
          <input type="range" data-k="${esc(k)}" min="${d.min ?? 0}" max="${d.max ?? 1}" step="${d.step ?? 0.01}" value="${vals[k]}" ${locked.includes(k) ? 'disabled' : ''}>
        </label>`).join('')}</div>
      <div class="sp-readout"></div>
    </div>
    <div class="sp-plots"></div>`;
  const $ = (s) => host.querySelector(s);
  const canvas = $('.sp-canvas');
  const tp = new TimePlot($('.sp-plots'), { series: plots.map(sp => plotSeries(sim, sp)), onSeek: (t) => { clock.pause(); clock.seek(t); },
    snapshot: (t) => (model.snapshot ? model.snapshot(p, t) : null) });
  const rate = () => (model.playRate ? model.playRate(p) : 1);
  const clock = new Clock({ tEnd: 1, onFrame: (t) => frame(t), onEnd: () => { $('.sp-play').textContent = '▶'; } });

  function rebuild() {
    p = toModel(sim, vals);
    trace = buildTrace(model, p);
    clock.tEnd = trace.tEnd; clock.speed = +$('.sp-speed').value * rate();
    view = null;
    tp.setTrace(trace);
    const w = model.validity ? model.validity(p) : [];
    $('.sp-warn').hidden = !w.length; $('.sp-warn').textContent = w.join(' ');
    $('.sp-bar').hidden = !!trace.static;
    for (const [k, d] of Object.entries(sim.params)) $(`[data-v="${k}"]`).textContent = `${fmt(vals[k])} ${unitText(d.unit)}`;
    clock.seek(Math.min(clock.t, trace.tEnd));
  }
  function frame(t) {
    const s = stateAt(trace, t);
    const { ctx, W, H } = fitCanvas(canvas);
    if (W < 40 || H < 40) return;   // まだ画面に配置されていない
    const C = colors();
    ctx.clearRect(0, 0, W, H);
    if (!view || view.W !== W || view.H !== H) { const b = R.bounds(p, trace); view = { ...viewport(W, H, b), b, W, H }; }
    R.draw(ctx, view, s, p, trace, C, model, t);
    tp.setTime(t);
    $('.sp-seek').value = Math.round(t / (trace.tEnd || 1) * 1000);
    $('.sp-time').textContent = `${fmt(t)} s`;
    readout(s);
  }
  function readout(s) {
    const ms = { ...(model.measures ? model.measures(p) : {}), ...(model.measureTrace ? model.measureTrace(trace) : {}) };
    // 状態の数値だけを出す（分布の配列はグラフで見る）
    const rows = Object.entries(sim.observables).filter(([k]) => typeof s[k] === 'number' || s[k] === null).map(([k, u]) => [(sim.labels || {})[k] || k, s[k], unitText(u)]);
    const mrows = Object.entries(sim.measures || {}).map(([k, d]) => [d.label, ms[k], unitText(d.unit)]);
    $('.sp-readout').innerHTML = `<table><tbody>${rows.map(([l, v, u]) => `<tr><th>${esc(l)}</th><td>${fmt(v)} ${esc(u)}</td></tr>`).join('')}</tbody></table>
      ${mrows.length ? `<table class="sp-measures"><tbody>${mrows.map(([l, v, u]) => `<tr><th>${esc(l)}</th><td>${v == null ? '—' : `${fmt(v)} ${esc(u)}`}</td></tr>`).join('')}</tbody></table>` : ''}`;
  }

  $('.sp-play').addEventListener('click', () => {
    if (clock.playing) { clock.pause(); $('.sp-play').textContent = '▶'; } else { clock.play(); $('.sp-play').textContent = '❚❚'; }
  });
  $('.sp-reset').addEventListener('click', () => { clock.reset(); $('.sp-play').textContent = '▶'; });
  $('.sp-seek').addEventListener('input', (e) => { clock.pause(); $('.sp-play').textContent = '▶'; clock.seek(e.target.value / 1000 * trace.tEnd); });
  $('.sp-speed').addEventListener('change', (e) => { clock.speed = +e.target.value * rate(); });
  host.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('input', () => {
    vals[inp.dataset.k] = clamp(sim, inp.dataset.k, inp.value);
    clock.pause(); $('.sp-play').textContent = '▶'; clock.t = 0;
    rebuild(); onChange({ ...vals });
  }));
  const ro = new ResizeObserver(() => { view = null; frame(clock.t); });
  ro.observe(canvas);
  rebuild();
  return {
    get values() { return { ...vals }; },
    get trace() { return trace; },
    set(newVals) { vals = merge(sim, vals, newVals); host.querySelectorAll('input[data-k]').forEach(i => { i.value = vals[i.dataset.k]; }); clock.t = 0; rebuild(); },
    measure(name) { const ms = { ...(model.measures ? model.measures(p) : {}), ...(model.measureTrace ? model.measureTrace(trace) : {}) }; return ms[name]; },
    play() { $('.sp-play').click(); },
    destroy() { clock.destroy(); ro.disconnect(); },
  };
}

// 静止したグラフ（図の format: "sim-plot"）：シミュレーションのモデルから描くので、問題の条件と食い違わない
//   plot = { x: 't'（既定）| 量, y: [量…], t?: 時刻（波形 y-x のように時刻ごとに変わるグラフ）, snap?: true }
export async function drawSimPlot(host, sim, { preset = {}, x = 't', y = [], t = null, snap = false, height = 120 } = {}) {
  const model = await loadModel(sim);
  const p = toModel(sim, merge(sim, preset));
  const trace = buildTrace(model, p);
  const tp = new TimePlot(host, { series: [plotSeries(sim, { x, ys: y, zero: true, height, snap })], height, cursor: false,
    snapshot: (tt) => (model.snapshot ? model.snapshot(p, tt) : null) });
  tp.t = t ?? 0;
  tp.setTrace(trace);
  return trace;
}
