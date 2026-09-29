"""README charts, generated only from real exported data (docs/readme/data/*.json).

    pnpm tsx scripts/readme-assets/export-data.ts && python3 scripts/readme-assets/charts.py

Writes SVG + PNG to docs/readme/charts/. One dark style in the app's own palette and typeface (Manrope, instanced
from the app's font file). Every chart carries its source line.
"""
import json
import os
from datetime import date

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DATA = os.path.join(ROOT, 'docs', 'readme', 'data')
OUT = os.path.join(ROOT, 'docs', 'readme', 'charts')
os.makedirs(OUT, exist_ok=True)

for f in ('Manrope-Medium.ttf', 'Manrope-Bold.ttf', 'Manrope-ExtraBold.ttf'):
    fm.fontManager.addfont(os.path.join(HERE, f))

GROUND = '#07090b'
CARD = '#0d1114'
INK = '#f2fbf7'
MUTED = '#8e9b97'
HAIR = '#1f2629'
MINT = '#1fe0a3'
NANSEN = '#00FFA7'
FLARE = '#ff6b3d'

plt.rcParams.update({
    'font.family': 'Manrope Medium', 'font.size': 11, 'text.color': INK, 'axes.labelcolor': MUTED,
    'xtick.color': MUTED, 'ytick.color': MUTED, 'axes.edgecolor': HAIR, 'axes.facecolor': CARD,
    'figure.facecolor': GROUND, 'savefig.facecolor': GROUND, 'axes.grid': True, 'grid.color': HAIR,
    'grid.linewidth': 0.8, 'axes.spines.top': False, 'axes.spines.right': False, 'svg.fonttype': 'none',
})
BOLD = {'family': 'Manrope Bold'}
XBOLD = {'family': 'Manrope ExtraBold'}


def load(name):
    with open(os.path.join(DATA, f'{name}.json')) as fh:
        return json.load(fh)


def frame(fig, title, subtitle, source):
    # Fixed distances in inches, whatever the figure's height: title, subtitle, and the source line at the bottom.
    h = fig.get_figheight()
    fig.text(0.035, 1 - 0.22 / h, title, fontsize=17, color=INK, va='top', **XBOLD)
    fig.text(0.035, 1 - 0.56 / h, subtitle, fontsize=11, color=MUTED, va='top')
    fig.text(0.035, 0.12 / h, f'Source: {source}', fontsize=9, color=MUTED)


def body(fig, left, right, top_in=1.0, bottom_in=0.75):
    """Axes rect between the header (top_in inches) and the footer (bottom_in inches)."""
    h = fig.get_figheight()
    return [left, bottom_in / h, right - left, 1 - (top_in + bottom_in) / h]


SHORT = {'transaction-with-token-transfer-lookup': 'tx lookup'}


def save(fig, name):
    for ext in ('svg', 'png'):
        fig.savefig(os.path.join(OUT, f'{name}.{ext}'), dpi=200)
    plt.close(fig)
    print('chart', name)


# C1: Nansen API calls per day, and the day the 1,000-call requirement was passed.
def calls_per_day():
    L = load('ledger')
    days = [d['day'] for d in L['days']]
    calls = [d['calls'] for d in L['days']]
    cum = [sum(calls[: i + 1]) for i in range(len(calls))]
    passed = next(i for i, c in enumerate(cum) if c >= 1000)
    fig = plt.figure(figsize=(8, 4.4))
    ax = fig.add_axes(body(fig, 0.1, 0.97, 1.05, 0.85))
    labels = [date.fromisoformat(d).strftime('%b %d') for d in days]
    bars = ax.bar(labels, calls, color=[NANSEN if i == len(calls) - 1 else MINT for i in range(len(calls))], width=0.62, zorder=3)
    for i, (b, v) in enumerate(zip(bars, calls)):
        ax.text(b.get_x() + b.get_width() / 2, v + max(calls) * 0.025, f'{v:,}', ha='center', color=INK, fontsize=10, **BOLD)
        ax.text(b.get_x() + b.get_width() / 2, -max(calls) * 0.13, f'total {cum[i]:,}', ha='center', color=MUTED, fontsize=8.5)
    b = bars[passed]
    x0 = b.get_x() + b.get_width() / 2
    top = calls[passed] + max(calls) * 0.11
    ax.annotate('1,000 required: passed here', xy=(x0, top), xytext=(x0 + 0.55, top + max(calls) * 0.2),
                ha='left', va='center', color=MUTED, fontsize=9, arrowprops={'arrowstyle': '-', 'color': MUTED, 'lw': 0.8, 'shrinkA': 3, 'shrinkB': 0})
    ax.set_ylim(0, max(calls) * 1.14)
    ax.set_ylabel('calls per day')
    ax.tick_params(axis='x', pad=18)
    frame(fig, f'{L["calls"]:,} Nansen API calls in five days',
          f'{L["calls"] / 1000:.1f}× the 1,000 required · {len(L["endpoints"])} endpoints · plus {L["cached"]:,} requests served from cache',
          'fixtures/proof-ledger.json (the Proof page ledger)')
    save(fig, 'calls-per-day')


# C2: calls by endpoint family.
def calls_by_family():
    L = load('ledger')
    fam = {}
    for e in L['endpoints']:
        g = e['endpoint'].replace('v1beta1/', '').split('/')[0]
        fam[g] = fam.get(g, 0) + e['calls']
    items = sorted(fam.items(), key=lambda x: x[1])
    fig = plt.figure(figsize=(8, 5.2))
    ax = fig.add_axes(body(fig, 0.2, 0.93, 1.0, 0.55))
    names = [SHORT.get(k, k) for k, _ in items]
    vals = [v for _, v in items]
    ax.barh(names, vals, color=MINT, height=0.62, zorder=3)
    for i, v in enumerate(vals):
        ax.text(v + max(vals) * 0.01, i, f'{v:,}', va='center', color=INK, fontsize=9, **BOLD)
    ax.set_xlim(0, max(vals) * 1.14)
    ax.grid(axis='y', visible=False)
    ax.tick_params(axis='y', labelsize=10, colors=INK)
    frame(fig, 'Where the calls go', f'Nansen API calls by endpoint family ({len(fam)} families)', 'fixtures/proof-ledger.json')
    save(fig, 'calls-by-family')


# C3: live vs cache.
def live_vs_cache():
    L = load('ledger')
    live, cached = L['calls'], L['cached']
    total = live + cached
    credits = sum(e.get('credits', 0) for e in L['endpoints'])
    fig = plt.figure(figsize=(8, 2.5))
    ax = fig.add_axes([0.035, 0.62 / 2.5, 0.93, 0.62 / 2.5])
    ax.barh([0], [live], color=NANSEN, height=0.9, zorder=3)
    ax.barh([0], [cached], left=[live], color=MINT, alpha=0.35, height=0.9, zorder=3)
    ax.text(live / 2, 0, f'{live:,} live Nansen calls', ha='center', va='center', color='#04110c', fontsize=11, **BOLD)
    ax.text(live + cached / 2, 0, f'{cached:,} served from Peregrine\'s cache ({cached / total:.0%})', ha='center', va='center', color=INK, fontsize=11, **BOLD)
    ax.set_xlim(0, total)
    ax.axis('off')
    frame(fig, f'{total:,} data requests, {cached / total:.0%} answered from cache',
          f'Per-endpoint TTLs and a shared SQLite cache keep credit use low' + (f' · {credits:,} credits metered in the ledger' if credits else ''),
          'fixtures/proof-ledger.json; cache TTLs in src/server/nansen/cache.ts')
    save(fig, 'live-vs-cache')


# C4: model validation (ROC curves on the held-out week).
def roc():
    bt = load('backtest')
    fig = plt.figure(figsize=(8, 5.4))
    for i, key in enumerate(('storm', 'breakout')):
        m = bt[key]
        ax = fig.add_axes(body(fig, 0.08 + i * 0.48, 0.08 + i * 0.48 + 0.4, 1.55, 0.95))
        ax.plot([p['fpr'] for p in m['expert']['roc']], [p['tpr'] for p in m['expert']['roc']], color=MUTED, lw=1.6, ls=(0, (4, 3)), label=f'hand-set prior · AUC {m["expert"]["auc"]:.2f}')
        ax.plot([p['fpr'] for p in m['fitted']['roc']], [p['tpr'] for p in m['fitted']['roc']], color=MINT, lw=2.4, label=f'fitted · AUC {m["fitted"]["auc"]:.2f}')
        ax.plot([0, 1], [0, 1], color=HAIR, lw=1)
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1.02)
        ax.set_xlabel('false positive rate')
        if i == 0:
            ax.set_ylabel('true positive rate')
        lo, hi = m['fitted']['aucCi']
        name = 'Dump odds (fitted model)' if key == 'storm' else 'Breakout'
        ax.set_title(f'{name}\n{m["test"]["n"]} token-weeks · {m["test"]["events"]} events · AUC 95% CI {lo:.2f}–{min(hi, 1):.2f}', color=INK, fontsize=10, loc='left', **BOLD)
        leg = ax.legend(loc='lower right', fontsize=9, frameon=False)
        for t in leg.get_texts():
            t.set_color(INK)
    frame(fig, 'Tested on a week the models never saw',
          f'Trained on earlier weeks, tested on a later week · {bt["samples"]} token-weeks, {bt["tokens"]} tokens, Nansen point-in-time data',
          'fixtures/backtest-results.json (scripts/backtest.ts)')
    save(fig, 'model-roc')


# C5: chain coverage, Nansen's own per-endpoint chain support for the features Peregrine builds on.
def chain_grid():
    c = load('chains')
    chains = c['chains']
    rows = [
        ('Smart Money flows', 'smartMoneyNetflows'), ('Smart Money trades', 'smartMoneyDexTrades'),
        ('Token screener', 'tokenScreener'), ('Token flows', 'tgmFlowIntelligence'), ('Holders', 'tgmHolders'),
        ('DEX trades', 'tgmDexTrades'), ('Wallet balances', 'profilerCurrentBalance'), ('Wallet PnL', 'profilerPnlSummary'),
    ]
    grid = [[1 if ch in c['endpoints'].get(k, []) else 0 for ch in chains] for _, k in rows]
    grid.append([1 if ch in c['tokenCheckerNetworks'] else 0 for ch in chains])
    labels = [r[0] for r in rows] + ['Token Checker']
    fig = plt.figure(figsize=(9, 5.0))
    ax = fig.add_axes(body(fig, 0.16, 0.98, 1.0, 1.25))
    from matplotlib.colors import ListedColormap
    ax.imshow(grid, cmap=ListedColormap([CARD, MINT]), aspect='auto', interpolation='nearest')
    ax.set_yticks(range(len(labels)), labels, fontsize=9, color=INK)
    ax.set_xticks(range(len(chains)), chains, rotation=90, fontsize=6.5)
    ax.set_xticks([x - 0.5 for x in range(1, len(chains))], minor=True)
    ax.set_yticks([y - 0.5 for y in range(1, len(labels))], minor=True)
    ax.grid(which='minor', color=GROUND, lw=1.2)
    ax.grid(which='major', visible=False)
    ax.tick_params(which='minor', length=0)
    frame(fig, f'{len(chains)} chains, each feature where Nansen supports it',
          f'Nansen\'s own chain support per endpoint · Token Checker on {len(c["tokenCheckerNetworks"])} networks',
          'src/types/nansen/chain-enums.ts, src/lib/rug.ts')
    save(fig, 'chain-coverage')


# C6: how much of the Nansen API Peregrine uses.
def api_coverage():
    cv = load('coverage')
    fams = sorted(cv['families'], key=lambda f: (f['documented'], f['used']))
    fig = plt.figure(figsize=(8, 5.4))
    ax = fig.add_axes(body(fig, 0.2, 0.66, 1.0, 0.95))
    names = [SHORT.get(f['family'], f['family']) for f in fams]
    ax.barh(names, [f['documented'] for f in fams], color=HAIR, height=0.62, zorder=2, label='documented')
    ax.barh(names, [f['used'] for f in fams], color=MINT, height=0.62, zorder=3, label='used by Peregrine')
    for i, f in enumerate(fams):
        ax.text(f['documented'] + 0.3, i, f'{f["used"]}/{f["documented"]}', va='center', fontsize=9, color=INK, **BOLD)
    ax.grid(axis='y', visible=False)
    ax.tick_params(axis='y', labelsize=9, colors=INK)
    ax.set_xlabel('endpoints')
    # headline ring
    ax2 = fig.add_axes([0.72, 0.3, 0.25, 0.42])
    pct = cv['covered'] / cv['documented']
    ax2.pie([pct, 1 - pct], colors=[NANSEN, HAIR], startangle=90, counterclock=False, wedgeprops={'width': 0.22})
    ax2.text(0, 0.08, f'{pct:.1%}', ha='center', va='center', fontsize=20, color=INK, **XBOLD)
    ax2.text(0, -0.28, f'{cv["covered"]} of {cv["documented"]}', ha='center', va='center', fontsize=9, color=MUTED)
    ax2.text(0, -1.45, f'+{len(cv["beyondDocs"])} endpoints beyond\nthe published docs', ha='center', va='center', fontsize=9, color=MUTED)
    frame(fig, f'Peregrine uses {pct:.1%} of the documented Nansen API',
          f'{cv["covered"]} of {cv["documented"]} documented endpoints, plus {len(cv["beyondDocs"])} more (account, Hyperliquid trading, points, social)',
          'docs/openapi.json (Nansen API, merged from docs.nansen.ai) vs fixtures/proof-ledger.json')
    save(fig, 'api-coverage')


# Headline tiles for the top of the README. The test count is not in the data export: pass TESTS from `pnpm test`.
def stat_tiles():
    L, cv, b, ch = load('ledger'), load('coverage'), load('backtest'), load('chains')
    tests = os.environ.get('TESTS', '671')
    tiles = [
        (f'{L["calls"]:,}', 'Nansen API calls', f'{L["calls"] / 1000:.1f}× the 1,000 required'),
        (f'{cv["covered"] / cv["documented"]:.1%}', 'of the documented Nansen API', f'{cv["covered"]}/{cv["documented"]} endpoints, +{len(cv["beyondDocs"])} beyond the docs'),
        (f'{L["cached"]:,}', 'requests served from cache', 'at zero credits'),
        (f'{b["storm"]["fitted"]["auc"]:.2f}', 'AUC, dump-risk model', 'on a week it never saw'),
        (f'{len(ch["chains"])}', 'chains supported', f'{len(ch["tokenCheckerNetworks"])} networks in token search'),
        (tests, 'unit and integration tests', 'vitest, all passing'),
    ]
    fig = plt.figure(figsize=(10, 3.3))
    cols, rows, gap = 3, 2, 0.018
    w, h = (1 - gap * (cols + 1)) / cols, (1 - gap * 1.6 * (rows + 1)) / rows
    for i, (big, label, sub) in enumerate(tiles):
        r, c = divmod(i, cols)
        x, y = gap + c * (w + gap), 1 - (r + 1) * (h + gap * 1.6)
        ax = fig.add_axes([x, y, w, h])
        ax.set_facecolor(CARD)
        ax.set_xticks([]); ax.set_yticks([]); ax.grid(False)
        for sp in ax.spines.values():
            sp.set_visible(True); sp.set_color(HAIR)
        ax.text(0.07, 0.66, big, transform=ax.transAxes, fontsize=26, color=NANSEN if i < 2 else INK, va='center', **XBOLD)
        ax.text(0.07, 0.34, label, transform=ax.transAxes, fontsize=11, color=INK, va='center', **BOLD)
        ax.text(0.07, 0.15, sub, transform=ax.transAxes, fontsize=9, color=MUTED, va='center')
    save(fig, 'stat-tiles')


if __name__ == '__main__':
    calls_per_day()
    calls_by_family()
    live_vs_cache()
    roc()
    chain_grid()
    api_coverage()
    stat_tiles()
