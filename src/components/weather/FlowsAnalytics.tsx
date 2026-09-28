import { Card } from '@/components/Card';
import { FlowIndexHistory, RankBars } from '@/components/charts/IntelCharts';
import { InsightPanel } from '@/components/pulse/MarketPulse';
import { flowsAnalytics } from '@/server/insights';
import { flowIndexHistory } from '@/server/graph/series';
import type { DisplayMode } from '@/server/mode';

/** The Chain flows page's analytical overview: insights with a Nansen brief, net flow per chain, Flow Index moves and history. */
export function FlowsAnalytics({ mode }: { mode: DisplayMode }) {
  const a = flowsAnalytics(mode);
  return (
    <div className="space-y-4">
      <InsightPanel id="flows-pulse" title="Chain flow pulse" items={a.insights} briefKey="flows" mode={mode} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="chain-net" title="Net flow by chain, 24h" sub={mode === 'owner' ? 'Smart Money chains · select a bar to open the chain' : 'All traders · select a bar to open the chain'}>
          <RankBars rows={a.net} label="Net flow per chain in 24 hours" />
        </Card>
        <Card id="chain-index-history" title="Flow Index, 7 days" sub="The chains that moved most · 50 is neutral · select a line" className="xl:col-span-2">
          <FlowIndexHistory series={flowIndexHistory(7, 6, mode === 'owner' ? 'smart-money' : 'market-flow')} />
        </Card>
      </div>
      {a.index.length > 0 && (
        <Card id="chain-index-moves" title="Flow Index change, 6 hours" sub="Points of Flow Index gained or lost">
          <RankBars rows={a.index} format="pts" label="Largest 6-hour Flow Index changes" />
        </Card>
      )}
    </div>
  );
}
