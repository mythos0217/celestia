#!/usr/bin/env python3
"""正規データ（content/）の整合検査。JSON Schema では見られない「ファイルどうし・データどうし」の関係を調べる。

    python3 tools/validate_content.py                 いつもの検査（CI でも実行）
    python3 tools/validate_content.py --write-golden  問題ID の台帳 tests/golden/ids.txt を今のデータで作り直す

調べること
  ID      問題ID の重複、フォルダ名・分野フォルダとの一致、台帳（tests/golden/ids.txt）にある ID が消えていないか
  分類    unit が field の下にあるか（taxonomy.json）
  図      ID の重複、参照先ファイルの有無、参照されない図・フォルダ内の孤立ファイル、
          問題文が解答用の図を参照していないか（解答図の漏れ）、解答用の図が解説から参照されているか
  SVG     XML として読めるか、viewBox、script・foreignObject・on* 属性・外部 URL・埋め込み画像（base64）が無いか、大きさ
  物理    図に宣言した物理条件（physics）と SVG の実際の形の照合：
          斜面の角度、力・ベクトルの向き、つり合い（力の和が 0）、分解（成分の和＝元のベクトル）、長さの一致、
          分岐点の電流の保存
  参照    concepts / laws / misconceptions / remedy / シミュレーション ID・preset の範囲・locked・予測の実験条件
  小問    問題文の小問 ID と答えの小問 ID の一致
  単位    入力用の答えに書いた単位 [ ] が単位表にあるか
エラーが1件でもあれば終了コード 1。警告は表示するだけ。
"""
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_lib import CONTENT, ROOT, figure_refs, load_knowledge, load_problems, part_ids  # noqa: E402

GOLDEN = ROOT / 'tests' / 'golden' / 'ids.txt'
SVGNS = '{http://www.w3.org/2000/svg}'
MAX_SVG = 200_000
MAX_IMG = 600_000
ANGLE_TOL = 2.0       # 度
SUM_TOL = 0.04        # 和が 0 になるべきときの許容（最大の矢印の長さに対する比）

# 高校物理で使う単位（入力用の答えの [ ] に書けるもの）。次元の判定は今後 grade/units.js で行う
UNITS = set('''m s kg N J W Pa Hz V A Ω C F T Wb H K mol eV
m/s m/s^2 m/s² N/m kg·m/s kg*m/s N·s N*s rad rad/s J/K J/(mol·K) J/(kg·K) km km/h cm mm g min h
mA μA kV kΩ μF pF nm μm Pa·m^3 m^3 L ℃ °C deg ° 倍 回 個'''.split())


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f'{where}: {msg}')

    def warn(self, where, msg):
        self.warnings.append(f'{where}: {msg}')


# ---------------------------------------------------------------- SVG
def tag(el):
    return el.tag.replace(SVGNS, '')


def check_svg_file(path, R, where):
    data = path.read_bytes()
    if len(data) > MAX_SVG:
        R.err(where, f'{path.name} が大きすぎます（{len(data)} バイト、上限 {MAX_SVG}）')
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        R.err(where, f'{path.name} を XML として読めません：{e}')
        return None
    if tag(root) != 'svg':
        R.err(where, f'{path.name} の最上位が <svg> ではありません')
    if not root.get('viewBox'):
        R.err(where, f'{path.name} に viewBox がありません（拡大縮小できない）')
    for el in root.iter():
        t = tag(el)
        if t in ('script', 'foreignObject', 'iframe', 'object', 'embed'):
            R.err(where, f'{path.name} に <{t}> があります（使えません）')
        for k, v in el.attrib.items():
            name = k.split('}')[-1]
            if name.lower().startswith('on'):
                R.err(where, f'{path.name} にイベント属性 {name} があります')
            if name == 'href' and not v.startswith('#'):
                R.err(where, f'{path.name} が外部を参照しています（{v[:40]}）')
            if 'base64' in v:
                R.err(where, f'{path.name} に埋め込み画像（base64）があります。画像は別ファイルにしてください')
    return root


def arrow_vectors(root):
    """data-phys の付いた矢印（<g> の中の line と矢じりの polygon）→ {名前: (dx, dy, 長さ, 向き°)}
    向きは数学の角度（右 0°、反時計回り正）。手描きの SVG も同じ形にする（docs/figures.md）。"""
    out = {}
    for g in root.iter():
        name = g.get('data-phys')
        if not name or tag(g) != 'g':
            continue
        line = next((c for c in g if tag(c) == 'line'), None)
        head = next((c for c in g if tag(c) == 'polygon'), None)
        if line is None or head is None:
            continue
        x0, y0 = float(line.get('x1')), float(line.get('y1'))
        tip = head.get('points').split()[0].split(',')
        x1, y1 = float(tip[0]), float(tip[1])
        dx, dy = x1 - x0, -(y1 - y0)
        out[name] = (dx, dy, math.hypot(dx, dy), math.degrees(math.atan2(dy, dx)) % 360)
    return out


def surfaces(root):
    out = []
    for el in root.iter():
        if el.get('data-phys') == 'surface' and tag(el) == 'line':
            dx = float(el.get('x2')) - float(el.get('x1'))
            dy = -(float(el.get('y2')) - float(el.get('y1')))
            a = math.degrees(math.atan2(dy, dx)) % 180
            out.append(min(a, 180 - a))   # 水平からの傾き（0〜90°）
    return out


def angle_diff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def check_physics(fig, root, R, where):
    ph = fig.get('physics') or {}
    if not ph:
        return
    vecs = arrow_vectors(root)
    w = f'{where} 図 {fig["id"]}'
    if 'angle_deg' in ph:
        ss = surfaces(root)
        if not ss:
            R.err(w, 'angle_deg が宣言されているのに、data-phys="surface" の線がありません')
        elif not any(abs(s - ph['angle_deg']) <= ANGLE_TOL for s in ss):
            R.err(w, f'斜面の角度が宣言（{ph["angle_deg"]}°）と違います：図では {", ".join(f"{s:.1f}°" for s in ss)}')
    for key, prefix in (('forces', 'force:'), ('vectors', '')):
        for v in ph.get(key, []):
            name = v['name'] if ':' in v['name'] else prefix + v['name']
            if name not in vecs:
                R.err(w, f'{name} の矢印が図にありません')
                continue
            if angle_diff(vecs[name][3], v['dir_deg']) > ANGLE_TOL:
                R.err(w, f'{name} の向きが宣言（{v["dir_deg"]}°）と違います：図では {vecs[name][3]:.1f}°')
    if ph.get('equilibrium'):
        fs = [v for k, v in vecs.items() if k.startswith('force:')]
        if not fs:
            R.err(w, 'equilibrium なのに力の矢印（data-phys="force:…"）がありません')
        else:
            sx, sy = sum(v[0] for v in fs), sum(v[1] for v in fs)
            big = max(v[2] for v in fs)
            if math.hypot(sx, sy) > SUM_TOL * big:
                R.err(w, f'つり合いのはずなのに、力の矢印の和が 0 になりません（和の大きさ {math.hypot(sx, sy):.1f}、最大の力 {big:.1f}）')
    for dec in ph.get('decompositions', []):
        missing = [n for n in [dec['of']] + dec['into'] if n not in vecs]
        if missing:
            R.err(w, f'分解の矢印がありません：{", ".join(missing)}')
            continue
        sx = sum(vecs[n][0] for n in dec['into'])
        sy = sum(vecs[n][1] for n in dec['into'])
        ox, oy, ol, _ = vecs[dec['of']]
        if math.hypot(sx - ox, sy - oy) > SUM_TOL * ol:
            R.err(w, f'{dec["of"]} の分解が合いません（成分の和と元の矢印の差 {math.hypot(sx - ox, sy - oy):.1f}）')
    for group in ph.get('equalLength', []):
        ls = [vecs[n][2] for n in group if n in vecs]
        if len(ls) != len(group):
            R.err(w, f'長さをそろえる矢印がありません：{group}')
        elif max(ls) - min(ls) > SUM_TOL * max(ls):
            R.err(w, f'同じ大きさのはずの矢印の長さが違います：{group}（{", ".join(f"{x:.1f}" for x in ls)}）')
    for j in ph.get('junctions', []):
        vals = j.get('values', {})
        for n in j['in'] + j['out']:
            if n not in vecs:
                R.err(w, f'電流の矢印 {n} がありません')
        if vals and all(n in vals for n in j['in'] + j['out']):
            a, b = sum(vals[n] for n in j['in']), sum(vals[n] for n in j['out'])
            if abs(a - b) > 1e-3 * max(1, abs(a)):
                R.err(w, f'分岐点で電流が保存されていません（入 {a} ≠ 出 {b}）')


# ---------------------------------------------------------------- 問題
def check_problem(d, p, K, R, ids_seen):
    pid = p['id']
    where = f'{pid}'
    if pid in ids_seen:
        R.err(where, f'問題ID が重複しています（{ids_seen[pid]} と {d}）')
    ids_seen[pid] = d
    if d.name != pid:
        R.err(where, f'フォルダ名 {d.name} が問題ID と違います')
    if d.parent.name != p['field']:
        R.err(where, f'分野フォルダ {d.parent.name} と field {p["field"]} が違います（分野を移すときはフォルダも移す。ID は変えない）')
    units = {u['key']: u for u in K['taxonomy']['units']}
    if p['unit'] not in units:
        R.err(where, f'単元 {p["unit"]} が taxonomy.json にありません')
    elif units[p['unit']]['field'] != p['field']:
        R.err(where, f'単元 {p["unit"]} は分野 {units[p["unit"]]["field"]} のものです（field は {p["field"]}）')

    # 図
    figs = {}
    for fg in p['figures']:
        if fg['id'] in figs:
            R.err(where, f'図ID {fg["id"]} が重複しています')
        figs[fg['id']] = fg
    q_refs = figure_refs(p['statement']['blocks'])
    s_refs = [r for s in p['solutions'] for r in figure_refs(s['blocks'])]
    for r in q_refs + s_refs:
        if r not in figs:
            R.err(where, f'図 {r} を参照していますが、figures にありません')
    for r in q_refs:
        if r in figs and figs[r]['role'] == 'answer':
            R.err(where, f'問題文が解答用の図 {r} を参照しています（答え合わせ前に見えてしまう）')
    for fid, fg in figs.items():
        if fid not in q_refs and fid not in s_refs:
            R.err(where, f'図 {fid} がどこからも参照されていません')
        if fg['role'] == 'question' and fid not in q_refs:
            R.warn(where, f'問題用の図 {fid} が問題文で使われていません')
        if fg['role'] == 'answer' and fid not in s_refs:
            R.err(where, f'解答用の図 {fid} が解説で使われていません')
    used_files = {'problem.json'}
    for fg in p['figures']:
        if fg.get('src'):
            f = d / fg['src']
            used_files.add(fg['src'])
            if not f.exists():
                R.err(where, f'図 {fg["id"]} のファイル {fg["src"]} がありません')
                continue
            if f.suffix == '.svg':
                spec = f.with_name(f.name.replace('.svg', '.fig.json'))
                if spec.exists():
                    used_files.add(spec.name)
                root = check_svg_file(f, R, where)
                if root is not None:
                    check_physics(fg, root, R, where)
            elif f.stat().st_size > MAX_IMG:
                R.err(where, f'{fg["src"]} が大きすぎます（{f.stat().st_size} バイト。長辺 1600px 以下の WebP に）')
            if f.suffix in ('.png', '.webp') and fg.get('physics'):
                R.warn(where, f'画像 {fg["src"]} の physics は自動照合できません（人の確認が必要）')
        if fg['format'] in ('sim-plot', 'sim-snapshot'):
            check_sim_ref(fg['sim']['id'], fg['sim'].get('preset', {}), [], K, R, f'{where} 図 {fg["id"]}')
    for f in d.iterdir():
        if f.is_file() and f.name not in used_files:
            R.err(where, f'フォルダに使われていないファイル {f.name} があります')

    # 小問
    q_parts = part_ids(p['statement']['blocks'])
    a_parts = [x['id'] for x in p['answer']['parts']]
    if q_parts and q_parts != a_parts:
        R.err(where, f'問題文の小問 {q_parts} と答えの小問 {a_parts} が対応していません')
    if not q_parts and a_parts != ['main']:
        R.err(where, f'小問の無い問題の答えは id "main" 1つにしてください（今は {a_parts}）')

    # 参照
    concepts = {c['id'] for c in K['concepts']}
    laws = {x['id'] for x in K['laws']}
    mcs = {m['id'] for m in K['misconceptions']}
    for c in p['concepts']:
        if c not in concepts:
            R.err(where, f'概念 {c} が concepts.json にありません')
    for x in p['laws']:
        if x not in laws:
            R.err(where, f'法則 {x} が laws.json にありません')
    mc_refs = list(p['misconceptions'])
    mc_refs += [c['misconception'] for c in (p.get('choices') or []) if c.get('misconception')]
    mc_refs += [c['misconception'] for c in (p.get('predict') or {}).get('choices', []) if c.get('misconception')]
    mc_refs += [w['misconception'] for x in p['answer']['parts'] for w in x.get('wrong', [])]
    for m in mc_refs:
        if m not in mcs:
            R.err(where, f'誤概念 {m} が misconceptions.json にありません')
    if not p['concepts']:
        R.warn(where, 'concepts が空です')

    # シミュレーション
    if p.get('simulation'):
        s = p['simulation']
        check_sim_ref(s['id'], s.get('preset', {}), s.get('locked', []), K, R, where)
    if p.get('predict'):
        pr = p['predict']
        if pr['answer'] not in [c['id'] for c in pr['choices']]:
            R.err(where, f'予測の正解 {pr["answer"]} が選択肢にありません')
        ex = pr.get('experiment')
        if ex:
            sim = check_sim_ref(ex['sim'], {}, [], K, R, f'{where} 予測')
            if sim:
                for k in ex.get('vary', {}):
                    if k not in sim['params']:
                        R.err(where, f'予測の実験で変える {k} がシミュレーション {sim["id"]} のパラメータにありません')
                if ex.get('measure') and ex['measure'] not in (sim.get('measures') or {}) and ex['measure'] not in sim['observables']:
                    R.err(where, f'予測の実験で測る {ex["measure"]} を {sim["id"]} は測れません')
        for x in pr.get('explain', {}).get('laws', []):
            if x not in laws:
                R.err(where, f'予測の説明の法則 {x} が laws.json にありません')

    # 単位
    for x in p['answer']['parts']:
        for u in re.findall(r'\[([^\[\]]+)\]\s*$', x.get('grading', '')):
            if u.strip() not in UNITS:
                R.err(where, f'({x["id"]}) の単位 [{u}] が単位表にありません（tools/validate_content.py の UNITS）')

    # 公開状態
    q = p['quality']
    if q['status'] == 'published' and any(f.get('format') in ('png', 'webp') for f in p['figures']) and not q['checks'].get('human'):
        R.warn(where, '写真・画像の図は人の確認（checks.human）を付けてから公開してください')


def check_sim_ref(sid, preset, locked, K, R, where):
    sims = {s['id']: s for s in K['simulations']}
    if sid not in sims:
        R.err(where, f'シミュレーション {sid} が simulations.json にありません')
        return None
    sim = sims[sid]
    for k, v in preset.items():
        if k not in sim['params']:
            R.err(where, f'preset の {k} は {sid} のパラメータにありません')
            continue
        prm = sim['params'][k]
        if ('min' in prm and v < prm['min']) or ('max' in prm and v > prm['max']):
            R.err(where, f'preset の {k}={v} が範囲 [{prm.get("min")}, {prm.get("max")}] の外です')
    for k in locked:
        if k not in sim['params']:
            R.err(where, f'locked の {k} は {sid} のパラメータにありません')
    return sim


# ---------------------------------------------------------------- 知識（概念・法則・誤概念）
def check_knowledge(K, problem_ids, R):
    for name, items in (('concepts', K['concepts']), ('laws', K['laws']), ('misconceptions', K['misconceptions']),
                        ('simulations', K['simulations'])):
        seen = set()
        for it in items:
            if it['id'] in seen:
                R.err(f'{name}.json', f'ID {it["id"]} が重複しています')
            seen.add(it['id'])
    concepts = {c['id']: c for c in K['concepts']}
    laws = {x['id'] for x in K['laws']}
    fields = {f['key'] for f in K['taxonomy']['fields']}
    for c in K['concepts']:
        if c['field'] not in fields:
            R.err('concepts.json', f'{c["id"]} の分野 {c["field"]} がありません')
        for r in c['requires']:
            if r not in concepts:
                R.err('concepts.json', f'{c["id"]} の前提 {r} がありません')
        for x in c['laws']:
            if x not in laws:
                R.err('concepts.json', f'{c["id"]} の法則 {x} が laws.json にありません')
    # 前提関係に循環が無いか
    state = {}

    def visit(cid, path):
        if state.get(cid) == 1:
            R.err('concepts.json', f'前提関係が循環しています：{" → ".join(path + [cid])}')
            return
        if state.get(cid) == 2 or cid not in concepts:
            return
        state[cid] = 1
        for r in concepts[cid]['requires']:
            visit(r, path + [cid])
        state[cid] = 2
    for cid in concepts:
        visit(cid, [])
    for x in K['laws']:
        for c in x['concepts']:
            if c not in concepts:
                R.err('laws.json', f'{x["id"]} の概念 {c} が concepts.json にありません')
    for m in K['misconceptions']:
        for c in m['concepts']:
            if c not in concepts:
                R.err('misconceptions.json', f'{m["id"]} の概念 {c} がありません')
        for pid in m['remedy']:
            if pid not in problem_ids:
                R.err('misconceptions.json', f'{m["id"]} の補強問題 {pid} がありません')
    for s in K['simulations']:
        if s['field'] not in fields:
            R.err('simulations.json', f'{s["id"]} の分野 {s["field"]} がありません')
        for k, prm in s['params'].items():
            if 'min' in prm and 'max' in prm and not (prm['min'] <= prm['default'] <= prm['max']):
                R.err('simulations.json', f'{s["id"]} の {k} の既定値 {prm["default"]} が範囲の外です')
        for ax in s['plots']:
            for q in ax:
                if q != 't' and q not in s['observables']:
                    R.err('simulations.json', f'{s["id"]} のグラフの軸 {q} が observables にありません')
        if s['status'] == 'ready' and not (ROOT / 'js' / 'sim' / 'models' / f'{s["model"]}.js').exists():
            R.err('simulations.json', f'{s["id"]} は ready ですが js/sim/models/{s["model"]}.js がありません')


def main():
    R = Report()
    K = load_knowledge()
    probs = load_problems()
    ids_seen = {}
    for d, p in probs:
        check_problem(d, p, K, R, ids_seen)
    check_knowledge(K, set(ids_seen), R)
    ids = sorted(ids_seen)
    if '--write-golden' in sys.argv:
        GOLDEN.parent.mkdir(parents=True, exist_ok=True)
        old = set(GOLDEN.read_text(encoding='utf-8').split()) if GOLDEN.exists() else set()
        GOLDEN.write_text('\n'.join(sorted(old | set(ids))) + '\n', encoding='utf-8')
        print(f'台帳 tests/golden/ids.txt を更新しました（{len(old | set(ids))}件）')
    elif GOLDEN.exists():
        lost = sorted(set(GOLDEN.read_text(encoding='utf-8').split()) - set(ids))
        for x in lost:
            R.err('台帳', f'問題ID {x} が消えています（ID は消さない。出さないときは quality.status を hidden に）')
    nfig = sum(len(p['figures']) for _, p in probs)
    print(f'問題 {len(probs)}問・図 {nfig}枚・概念 {len(K["concepts"])}・法則 {len(K["laws"])}・誤概念 {len(K["misconceptions"])}・'
          f'シミュレーション {len(K["simulations"])} を検査：エラー {len(R.errors)}件、警告 {len(R.warnings)}件')
    for e in R.errors[:60]:
        print('  ✗', e)
    for w in R.warnings[:30]:
        print('  ・', w)
    sys.exit(1 if R.errors else 0)


if __name__ == '__main__':
    main()
