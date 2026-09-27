import { SmFlowChart, WalletGraph } from '@/components/charts/IntelCharts';
import { smFlowSeries, walletGraph } from '@/server/graph/series';
import { usd } from '@/lib/viz/format';
import { compact } from '@/lib/compact';

/** Smart Money flow over time and the wallet network, from stored scanner reads (no Nansen call on view). */
export function SmartMoneyCharts() {
  const flow = smFlowSeries(168);
  const graph = walletGraph();
  const buy = flow.reduce((a, p) => a + p.buy, 0), sell = flow.reduce((a, p) => a + p.sell, 0);
  const peak = flow.reduce<(typeof flow)[number] | null>((m, p) => (!m || Math.abs(p.net) > Math.abs(m.net) ? p : m), null);
  const wallets = graph.nodes.filter((n) => n.kind === 'wallet').length, markets = graph.nodes.length - wallets;
  return (
    <div className="grid gap-4">
      <section aria-labelledby="smflow" className="material min-w-0 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="smflow" className="t-section">Smart Money DEX flow, hourly</h2>
          <span className="text-[12px] text-ink-muted">7 days · stored trades</span>
        </div>
        <p className="num mb-2 text-[12.5px] text-ink-2">
          Bought <span className="font-semibold text-ink">{usd(buy)}</span> · sold <span className="font-semibold text-ink">{usd(sell)}</span> · net <span className="font-semibold" style={{ color: buy - sell >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(buy - sell, { signed: true })}</span>
          {peak && <> · biggest hour {new Date(peak.t).toISOString().slice(5, 13).replace('T', ' ')}:00 UTC ({usd(peak.net, { signed: true })})</>}
        </p>
        <SmFlowChart points={compact(flow)} />
      </section>
      <section aria-labelledby="wgraph" className="material min-w-0 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="wgraph" className="t-section">Wallet network</h2>
          <span className="text-[12px] text-ink-muted">{wallets} wallets · {markets} markets · {graph.links.length} ties</span>
        </div>
        <p className="mb-2 text-[12.5px] text-ink-2">Wallets active in 2+ markets, grouped by position.</p>
        <WalletGraph nodes={compact(graph.nodes)} links={compact(graph.links)} />
      </section>
    </div>
  );
}
