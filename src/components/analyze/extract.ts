'use client';
// Turns a page element into what the analyst needs: its identity (token,
// wallet, market, coin, sector) and the real data behind it (chart series,
// table row by column, card contents), not just its label.

export type SelKind = 'chart' | 'token' | 'wallet' | 'market' | 'perp' | 'sector' | 'chain' | 'row' | 'card' | 'item';
export interface Selection {
  id: string;
  kind: SelKind;
  label: string;
  chain?: string;
  address?: string;
  symbol?: string;
  marketId?: string;
  data: unknown;
  el: HTMLElement;
}

/** What the picker may select, most specific first (closest() takes the nearest match). */
export const PICKABLE = '[data-analyze], tr, [role="img"], a[href^="/token/"], a[href^="/wallet/"], a[href^="/predict/"], a[href^="/perps/"], a[href^="/sectors/"], a[href^="/chain/"], li, section';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

function identity(href: string | null | undefined): Partial<Selection> {
  if (!href) return {};
  const [, a, b, c] = href.split('?')[0].split('/').map(decodeURIComponent);
  if (a === 'token' && b && c) return { kind: 'token', chain: b, address: c };
  if (a === 'wallet' && b) return { kind: 'wallet', address: b };
  if (a === 'predict' && b) return { kind: 'market', marketId: b };
  if (a === 'perps' && b && b !== 'compare') return { kind: 'perp', symbol: b };
  if (a === 'sectors' && b) return { kind: 'sector', symbol: b };
  if (a === 'chain' && b) return { kind: 'chain', chain: b };
  return {};
}

async function chartData(el: HTMLElement): Promise<unknown> {
  const host = el.querySelector<HTMLElement>('.echarts-for-react');
  if (host) {
    try {
      const echarts = await import('echarts');
      const inst = echarts.getInstanceByDom(host);
      const opt = inst?.getOption() as { series?: Array<{ name?: string; type?: string; data?: unknown[] }>; xAxis?: Array<{ data?: unknown[] }> } | undefined;
      if (opt?.series) {
        return {
          xAxis: opt.xAxis?.[0]?.data?.slice(-120),
          series: opt.series.map((s) => ({ name: s.name, type: s.type, points: Array.isArray(s.data) ? s.data.length : 0, data: Array.isArray(s.data) ? s.data.slice(-120) : undefined })),
        };
      }
    } catch { /* fall back to the series attribute */ }
  }
  const series = el.getAttribute('data-series');
  if (series) try { return { series: JSON.parse(series) }; } catch { /* ignore */ }
  return { description: el.getAttribute('aria-label') };
}

function rowData(tr: HTMLTableRowElement) {
  const table = tr.closest('table');
  const heads = [...(table?.tHead?.rows[0]?.cells ?? [])].map((c) => text(c) || `col${c.cellIndex}`);
  const row: Record<string, string> = {};
  [...tr.cells].forEach((c, i) => { row[heads[i] ?? `col${i}`] = text(c); });
  const title = text(tr.closest('section')?.querySelector('h2,h3'));
  return { table: title || undefined, row };
}

function cardData(el: HTMLElement) {
  const links = [...el.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')].slice(0, 40).map((a) => ({ text: clip(text(a), 80), href: a.getAttribute('href') }));
  return { title: text(el.querySelector('h1,h2,h3')) || undefined, contents: clip((el as HTMLElement).innerText.replace(/\n{2,}/g, '\n'), 4000), links };
}

let seq = 0;
export async function extract(el: HTMLElement): Promise<Selection> {
  const id = `sel${++seq}`;
  const tagged = el.getAttribute('data-analyze');
  if (tagged) {
    try {
      const d = JSON.parse(tagged) as Record<string, unknown>;
      return { id, el, kind: (d.kind as SelKind) ?? 'card', label: String(d.label ?? text(el).slice(0, 60)), ...identity(d.href as string), data: d };
    } catch { /* treat as a card */ }
  }
  if (el.matches('tr')) {
    const who = identity(el.querySelector('a[href^="/"]')?.getAttribute('href'));
    const data = rowData(el as HTMLTableRowElement);
    return { id, el, ...who, kind: 'row', label: clip(Object.values(data.row)[0] ?? 'Row', 40), data };
  }
  if (el.matches('[role="img"]')) return { id, el, kind: 'chart', label: clip(el.getAttribute('aria-label') ?? 'Chart', 60), data: await chartData(el) };
  if (el.matches('a[href]')) {
    const who = identity(el.getAttribute('href'));
    const around = el.closest('tr, li, section');
    return { id, el, kind: 'item', ...who, label: clip(text(el), 40) || 'Link', data: { text: clip(text(el), 200), context: around ? clip((around as HTMLElement).innerText, 1500) : undefined } };
  }
  const who = identity(el.querySelector('a[href^="/"]')?.getAttribute('href'));
  if (el.matches('li')) return { id, el, ...who, kind: 'item', label: clip(text(el), 40), data: cardData(el) };
  return { id, el, kind: 'card', label: clip(text(el.querySelector('h1,h2,h3')) || 'Card', 40), data: cardData(el) };
}
