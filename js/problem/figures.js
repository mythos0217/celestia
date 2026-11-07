// 問題・解答の図を表示する。
//   本文の HTML には <figure class="pfig" data-fig="図ID"></figure> の空の枠だけがあり、
//   ここで data/f-*.json の figs の情報から中身を入れる。
//   解答用（role: "answer"）の図は、allowAnswer を付けて呼ぶまで中身を入れない（ファイルも読まない）。
//   SVG は文字として読み込んで埋め込む（色が明暗の設定に合わせて変わる・将来の操作できる図のため）。
export const FILE_VERSION = '0.3.0';

let esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function setFigureEsc(fn) { esc = fn; }

const svgCache = new Map();
async function loadSVG(src) {
  if (!svgCache.has(src)) {
    svgCache.set(src, fetch(src).then(r => { if (!r.ok) throw new Error(`${src} を読めません（${r.status}）`); return r.text(); })
      .catch(e => { svgCache.delete(src); throw e; }));
  }
  return svgCache.get(src);
}

// 念のための無害化（データは tools/validate_content.py で検査済みだが、表示側でも script・イベント属性・外部参照を落とす）
export function sanitizeSVG(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('SVG を読めません');
  svg.querySelectorAll('script, foreignObject, iframe, object, embed').forEach(n => n.remove());
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || ((n === 'href' || n === 'xlink:href') && !a.value.startsWith('#'))) el.removeAttribute(a.name);
    }
  }
  svg.removeAttribute('width'); svg.removeAttribute('height');
  return svg;
}

function captionHTML(info) {
  return info.cap ? `<figcaption>${info.cap}</figcaption>` : '';
}

// container の中の空の図の枠に中身を入れる。描画が終わったら onDone(figure要素) を呼ぶ（数式の描画用）
export function mountFigures(container, figs, { allowAnswer = false, onDone = () => {}, sims = null } = {}) {
  const jobs = [];
  for (const box of container.querySelectorAll('figure.pfig[data-fig]')) {
    if (box.dataset.mounted) continue;
    const id = box.dataset.fig, info = (figs || {})[id];
    if (!info) { box.innerHTML = `<div class="fig-missing">図 ${esc(id)} がありません</div>`; box.dataset.mounted = '1'; continue; }
    if (info.role === 'answer' && !allowAnswer) { box.hidden = true; continue; }   // 答え合わせまで出さない
    box.hidden = false;
    box.dataset.mounted = '1';
    box.dataset.role = info.role;
    box.dataset.kind = info.kind;
    if (info.w) box.style.setProperty('--fig-w', `${info.w}px`);
    if (info.role === 'answer') box.classList.add('fig-answer');
    if (info.format === 'svg') {
      box.innerHTML = `<div class="fig-body loading" role="img" aria-label="${esc(info.alt)}"></div>${captionHTML(info)}`;
      jobs.push(loadSVG(info.src).then(text => {
        const body = box.querySelector('.fig-body');
        body.classList.remove('loading');
        const svg = sanitizeSVG(text);
        svg.setAttribute('aria-hidden', 'true');
        body.appendChild(document.importNode(svg, true));
        onDone(box);
      }).catch(e => { box.querySelector('.fig-body').innerHTML = `<div class="fig-missing">${esc(e.message)}</div>`; }));
    } else if (info.format === 'png' || info.format === 'webp') {
      box.innerHTML = `<div class="fig-body"><img src="${esc(info.src)}" alt="${esc(info.alt)}" loading="lazy" decoding="async"></div>${captionHTML(info)}`;
      onDone(box);
    } else if (info.format === 'sim-plot' && sims && sims[info.sim.id]) {
      // シミュレーションのモデルから描くグラフ（問題の条件と同じモデルなので食い違わない）
      box.innerHTML = `<div class="fig-body fig-plot" role="img" aria-label="${esc(info.alt)}"></div>${captionHTML(info)}`;
      jobs.push(import('../sim/ui/player.js').then(M => M.drawSimPlot(box.querySelector('.fig-body'), sims[info.sim.id],
        { preset: info.sim.preset || {}, x: (info.plot && info.plot.x) || 't', y: (info.plot && info.plot.y) || [], t: info.sim.t ?? null, snap: !!(info.plot && info.plot.snap), height: 150 })).then(() => onDone(box))
        .catch(e => { box.querySelector('.fig-body').innerHTML = `<div class="fig-missing">${esc(e.message)}</div>`; }));
    } else {
      // sim-snapshot・plot-json はまだ描けない
      box.innerHTML = `<div class="fig-body fig-pending" role="img" aria-label="${esc(info.alt)}">${esc(info.alt)}<small>（シミュレーションから描く図：準備中）</small></div>${captionHTML(info)}`;
      onDone(box);
    }
  }
  return Promise.all(jobs);
}
