#!/usr/bin/env python3
"""正規データ（content/）→ アプリ用データ（data/）

    python3 tools/build_data.py [content フォルダ] [data フォルダ]

書き出すもの
  data/index.json        一覧（単元・問題の要約）。format = "celestia.data/1"
  data/f-<単元ID>.json    本文（問題文・答え・解説の HTML と、図の情報）
  data/knowledge.json    概念・法則・誤概念・シミュレーション登録簿
  data/search.json       検索用の索引
  data/collections.json  問題セット
  data/assets/<問題ID>/  図のファイル（名前に中身のハッシュを付ける＝内容が変わればキャッシュも変わる）

本文の HTML では、図は <figure class="pfig" data-fig="図ID"></figure> の空の枠として置き、
アプリが表示するときに figs の情報で中身を入れる（解答用の図は答え合わせまで入れない）。
quality.status が "published" 以外の問題は出さない。
"""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_lib import CONTENT, ROOT, load_knowledge, load_problems, read  # noqa: E402
from latex_html import WARN, render  # noqa: E402
import tags as TG  # noqa: E402

FORMAT = 'celestia.data/1'
LEVELS = {0: '基礎', 1: '標準', 2: '入試基礎', 3: '国公立2次', 4: '難関', 5: '最難関'}


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def blocks_html(blocks, ctx):
    out = []
    for b in blocks:
        t = b['type']
        if t == 'text':
            out.append(render(b['tex'], ctx))
        elif t == 'figure':
            pl = b.get('placement', 'block')
            out.append(f'<figure class="pfig pl-{pl}" data-fig="{esc(b["ref"])}"></figure>')
        elif t == 'parts':
            items = []
            for it in b['items']:
                figs = ''.join(f'<figure class="pfig" data-fig="{esc(r)}"></figure>' for r in it.get('figures', []))
                items.append(f'<li value="{esc(re.sub(r"[^0-9]", "", it["id"]) or 1)}"><span class="lb">({esc(it["id"])})</span>'
                             f'{render(it["tex"], ctx)}{figs}</li>')
            out.append('<ol>' + ''.join(items) + '</ol>')
        elif t == 'simulation':
            out.append(f'<div class="psim" data-cap="{esc(b.get("caption", ""))}"></div>')
    return '<br class="p">'.join(x for x in out if x)


def answer_html(parts, ctx):
    if len(parts) == 1 and parts[0]['id'] == 'main':
        return render(parts[0]['tex'], ctx)
    return '　'.join(f'({p["id"]}) {render(p["tex"], ctx)}' for p in parts)


def grading_spec(parts):
    """小問ごとの入力用の答えを、js/answer.js の書式（1行1小問）にまとめる"""
    lines = []
    for p in parts:
        if 'grading' not in p:
            continue
        lines.append(p['grading'] if p['id'] == 'main' else f'({p["id"]}) {p["grading"]}')
    return '\n'.join(lines) if lines else None


def asset_name(path):
    h = hashlib.sha256(path.read_bytes()).hexdigest()[:8]
    return f'{path.stem}-{h}{path.suffix}'


def plain(tex):
    """検索用の平文：数式と命令を除く"""
    t = re.sub(r'\$[^$]*\$|\\\[.*?\\\]', ' ', str(tex or ''), flags=re.S)
    t = re.sub(r'\\[a-zA-Z]+', ' ', t)
    return re.sub(r'[{}\\&]', ' ', t)


def data_version(content, problem_dirs):
    h = hashlib.sha256()
    files = [content / n for n in ('taxonomy.json', 'concepts.json', 'laws.json', 'misconceptions.json',
                                   'simulations.json', 'tags.json')]
    files += sorted((content / 'collections').glob('*.json')) if (content / 'collections').exists() else []
    for d in problem_dirs:
        files += sorted(p for p in d.iterdir() if p.is_file() and not p.name.endswith('.fig.json'))
    for p in files:
        if p.exists():
            h.update(str(p.relative_to(content)).encode())
            h.update(p.read_bytes())
    return h.hexdigest()[:12]


def build(content=CONTENT, out=ROOT / 'data'):
    content, out = Path(content), Path(out)
    K = load_knowledge(content)
    tax = K['taxonomy']
    probs = load_problems(content)
    version = data_version(content, [d for d, _ in probs])
    field_name = {f['key']: f['name'] for f in tax['fields']}
    field_order = {f['key']: f['order'] for f in tax['fields']}
    units = sorted(tax['units'], key=lambda u: (field_order[u['field']], u['order']))
    tagdict = TG.load(content)
    cmap = TG.canonical_map(tagdict) if tagdict else {}
    concept_name = {c['id']: c['name'] for c in K['concepts']}
    law_name = {x['id']: x['name'] for x in K['laws']}
    unknown = set()

    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('f-*.json'):
        old.unlink()
    if (out / 'assets').exists():
        shutil.rmtree(out / 'assets')

    index, bodies, search, hidden = [], {}, [], 0
    for d, p in probs:
        if p['quality']['status'] != 'published':
            hidden += 1
            continue
        ctx = {'id': p['id'], 'unknown': unknown}
        e = {'id': p['id'], 'f': p['unit'], 'lv': p['level'], 'fm': p['format']}
        if p.get('minutes'):
            e['t'] = p['minutes']
        if p.get('topic'):
            e['th'] = p['topic']
        if p.get('course'):
            e['co'] = p['course']
        tg = list(dict.fromkeys(TG.to_canonical(t, cmap) for t in p.get('tags', [])))
        if tg:
            e['tg'] = tg
        if p['concepts']:
            e['c'] = p['concepts']
        if p['misconceptions']:
            e['m'] = p['misconceptions']
        if p.get('simulation'):
            e['sim'] = p['simulation']['id']
        if p.get('predict'):
            e['pr'] = 1
        if p['quality'].get('verified'):
            e['ok'] = 1
        # 図：ファイルを data/assets/<ID>/ に写し、本文からは ID で引く
        figs = {}
        for fg in p['figures']:
            info = {k: fg[k] for k in ('role', 'kind', 'format', 'alt') if k in fg}
            if fg.get('caption'):
                info['cap'] = render(fg['caption'], ctx)
            if fg.get('width'):
                info['w'] = fg['width']
            if fg.get('src'):
                src = d / fg['src']
                name = asset_name(src)
                dst = out / 'assets' / p['id'] / name
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dst)
                info['src'] = f'data/assets/{p["id"]}/{name}'
            if fg.get('sim'):
                info['sim'] = fg['sim']
            if fg.get('plot'):
                info['plot'] = fg['plot']
            figs[fg['id']] = info
        sol = p['solutions'][0]
        b = {'q': blocks_html(p['statement']['blocks'], ctx),
             'a': answer_html(p['answer']['parts'], ctx),
             's': blocks_html(sol['blocks'], ctx),
             'k': render(p['idea']['tex'], ctx) if p.get('idea') else ''}
        alts = [s for s in p['solutions'][1:]]
        if alts:
            b['alt'] = [{'id': s['id'], 'kind': s['kind'], 'html': blocks_html(s['blocks'], ctx)} for s in alts]
        if figs:
            b['figs'] = figs
        spec = grading_spec(p['answer']['parts'])
        if spec:
            b['in'] = spec
            e['in'] = 1
        wrong = {pt['id']: pt['wrong'] for pt in p['answer']['parts'] if pt.get('wrong')}
        if wrong:
            b['wrong'] = wrong
        if p.get('simulation'):
            b['sim'] = p['simulation']
        if p.get('predict'):
            pr = dict(p['predict'])
            pr['choices'] = [{**c, 'html': render(c['tex'], ctx)} for c in pr['choices']]
            if pr.get('explain', {}).get('tex'):
                pr['explain'] = {**pr['explain'], 'html': render(pr['explain']['tex'], ctx)}
            b['predict'] = pr
        if p.get('choices'):
            b['choices'] = [{**c, 'html': render(c['tex'], ctx)} for c in p['choices']]
        if p['laws']:
            b['laws'] = p['laws']
        index.append(e)
        bodies.setdefault(p['unit'], {'_meta': {'dataVersion': version}})[p['id']] = b
        words = [p.get('topic', ''), field_name[p['field']]] + tg + [concept_name.get(c, '') for c in p['concepts']] \
            + [law_name.get(x, '') for x in p['laws']]
        text = ' '.join(blocks_html_text(p['statement']['blocks']))
        search.append([p['id'], TG.norm(plain(' '.join(words)) + ' ' + plain(text))])

    fields = [{'key': u['key'], 'subject': field_name[u['field']], 'fieldKey': u['field'], 'name': u['name']}
              for u in units if u['key'] in bodies]
    idx = {'format': FORMAT, 'dataVersion': version, 'generated': read(content / 'meta.json')['generated'],
           'source': 'content/', 'count': len(index), 'levels': LEVELS,
           'subjects': [f['name'] for f in sorted(tax['fields'], key=lambda f: f['order'])],
           'fields': fields, 'problems': index}
    dump(out / 'index.json', idx)
    for key, b in bodies.items():
        dump(out / f'f-{key}.json', b)
    knowledge = {'dataVersion': version,
                 'concepts': K['concepts'],
                 'laws': [{**x, 'html': f'${x["tex"]}$'} for x in K['laws']],
                 'misconceptions': K['misconceptions'],
                 'simulations': K['simulations']}
    dump(out / 'knowledge.json', knowledge)
    dump(out / 'search.json', {'dataVersion': version, 'items': search})
    ids = {e['id'] for e in index}
    cols = []
    for f in sorted((content / 'collections').glob('*.json')) if (content / 'collections').exists() else []:
        c = read(f)
        if c.get('visibility', 'public') == 'private':
            continue
        items = [it for it in c['items'] if it['id'] in ids]
        if items:
            cols.append({k: v for k, v in {**c, 'items': items}.items() if k != 'schema'})
    cols.sort(key=lambda c: (c.get('order', 10 ** 6), c['id']))
    dump(out / 'collections.json', {'dataVersion': version, 'collections': cols})
    return {'count': len(index), 'fields': len(fields), 'hidden': hidden, 'auto': sum(1 for e in index if e.get('in')),
            'figures': sum(len(b.get('figs', {})) for v in bodies.values() for k, b in v.items() if k != '_meta'),
            'dataVersion': version, 'unknown': sorted(unknown), 'warn': list(WARN)}


def blocks_html_text(blocks):
    for b in blocks:
        if b['type'] == 'text':
            yield b['tex']
        elif b['type'] == 'parts':
            for it in b['items']:
                yield it['tex']


def dump(path, obj):
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def main():
    args = sys.argv[1:]
    r = build(args[0] if args else CONTENT, args[1] if len(args) > 1 else ROOT / 'data')
    print(f"{r['count']}問を書き出しました（{r['fields']}単元、図 {r['figures']}枚、入力して採点できる問題 {r['auto']}問、"
          f"非公開 {r['hidden']}問、dataVersion {r['dataVersion']}）")
    if r['unknown']:
        print('文章中の未対応命令（名前だけ表示）:', ', '.join(r['unknown']))
    for w in r['warn'][:50]:
        print('  注意', w)


if __name__ == '__main__':
    main()
