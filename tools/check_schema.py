#!/usr/bin/env python3
"""正規データ（content/）が JSON Schema（tools/schema/）に合っているか調べる。
    python3 tools/check_schema.py            （pip3 install jsonschema が必要）
問題があれば終了コード 1。"""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit('jsonschema が必要です： pip3 install jsonschema')

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_lib import CONTENT as C, ROOT, problem_dirs, read  # noqa: E402

S = ROOT / 'tools' / 'schema'


def validator(name):
    return Draft202012Validator(read(S / f'{name}.schema.json'))


def check(v, obj, where, errs):
    for e in v.iter_errors(obj):
        errs.append(f'{where} {"/".join(map(str, e.path))}: {e.message[:160]}')


def main():
    errs = []
    for name, file in (('taxonomy', 'taxonomy.json'), ('content-meta', 'meta.json'), ('tags', 'tags.json'),
                       ('concepts', 'concepts.json'), ('laws', 'laws.json'), ('misconceptions', 'misconceptions.json'),
                       ('simulations', 'simulations.json')):
        check(validator(name), read(C / file), file, errs)
    pv, fv = validator('problem'), validator('figure')
    dirs = problem_dirs()
    nfig = 0
    for d in dirs:
        check(pv, read(d / 'problem.json'), f'{d.name}/problem.json', errs)
        for f in sorted(d.glob('*.fig.json')):
            nfig += 1
            check(fv, read(f), f'{d.name}/{f.name}', errs)
    cv = validator('collection')
    for f in sorted((C / 'collections').glob('*.json')) if (C / 'collections').exists() else []:
        check(cv, read(f), f'collections/{f.name}', errs)
    print(f'正規データ {len(dirs)}問・作図仕様 {nfig}個を検査、Schema に合わないもの {len(errs)}件')
    for e in errs[:40]:
        print(' ', e)
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()
