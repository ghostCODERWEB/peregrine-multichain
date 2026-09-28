"""Markdown table of every documented Nansen endpoint and Peregrine's call count, from docs/readme/data/coverage.json.

    python3 scripts/readme-assets/endpoint-table.py > /tmp/endpoints.md
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
cv = json.load(open(os.path.join(HERE, '..', '..', 'docs', 'readme', 'data', 'coverage.json')))
calls = cv['calls']
fams = {}
for p in cv['endpoints']:
    fams.setdefault(p.split('/')[0], []).append(p)
print('| Family | Endpoint | Calls |')
print('|---|---|--:|')
for f in sorted(fams, key=lambda f: -sum(calls.get(p, 0) for p in fams[f])):
    for p in sorted(fams[f], key=lambda p: -calls.get(p, 0)):
        n = calls.get(p, 0)
        print(f'| {f} | `{p}` | {n:,} |' if n else f'| {f} | `{p}` | not used |')
for p in sorted(cv['beyondDocs'], key=lambda p: -calls.get(p, 0)):
    print(f'| beyond the docs | `{p}` | {calls[p]:,} |')
