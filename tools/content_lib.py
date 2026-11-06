"""正規データ（content/）を読む共通処理。build_data.py・validate_content.py・check_schema.py が使う。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'content'


def read(p):
    return json.loads(Path(p).read_text(encoding='utf-8'))


def problem_dirs(content=CONTENT):
    """content/problems/<分野>/<問題ID>/problem.json のフォルダ一覧（並びは分野・ID 順）"""
    return sorted(p.parent for p in (Path(content) / 'problems').glob('*/*/problem.json'))


def load_problems(content=CONTENT):
    """[(フォルダ, 問題)]"""
    return [(d, read(d / 'problem.json')) for d in problem_dirs(content)]


def load_knowledge(content=CONTENT):
    c = Path(content)
    return {
        'taxonomy': read(c / 'taxonomy.json'),
        'concepts': read(c / 'concepts.json')['concepts'],
        'laws': read(c / 'laws.json')['laws'],
        'misconceptions': read(c / 'misconceptions.json')['misconceptions'],
        'simulations': read(c / 'simulations.json')['simulations'],
    }


def figure_refs(blocks):
    """ブロック列が参照している図 ID（小問の figures も含む）"""
    out = []
    for b in blocks:
        if b['type'] == 'figure':
            out.append(b['ref'])
        elif b['type'] == 'parts':
            for it in b['items']:
                out += it.get('figures', [])
    return out


def part_ids(blocks):
    return [it['id'] for b in blocks if b['type'] == 'parts' for it in b['items']]
