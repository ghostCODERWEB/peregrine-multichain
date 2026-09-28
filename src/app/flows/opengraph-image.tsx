import { ogCard, OG_SIZE } from '@/lib/og/card';
import { buildBulletin } from '@/server/weather/bulletin';
import { chainNets } from '@/lib/viz/net-flow-map';
import { chainName, usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Chain flows on Peregrine: net flow and Flow Index for every chain';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Chain flows: which chain took the most and lost the most, and how many lean each way. */
export default function Image() {
  const b = buildBulletin('public');
  const nets = chainNets(b.chains).sort((x, y) => y.net - x.net);
  const inflow = nets.find((n) => n.net > 0), outflow = [...nets].reverse().find((n) => n.net < 0);
  const acc = b.chains.filter((c) => c.cpi != null && c.cpi >= 65).length, dist = b.chains.filter((c) => c.cpi != null && c.cpi <= 35).length;
  const title = inflow && outflow ? `${chainName(inflow.chain)} took the most net flow; ${chainName(outflow.chain)} lost the most` : 'Net flow and Flow Index for every chain';
  return ogCard({
    section: 'Chain flows',
    title,
    subtitle: 'All traders, last 24 hours: net flow per chain and a 0–100 Flow Index against each chain’s own history.',
    stats: [
      { label: inflow ? `Top inflow · ${chainName(inflow.chain)}` : 'Top inflow', value: inflow ? usd(inflow.net, { signed: true }) : 'n/a', tone: 'up' },
      { label: outflow ? `Top outflow · ${chainName(outflow.chain)}` : 'Top outflow', value: outflow ? usd(outflow.net, { signed: true }) : 'n/a', tone: 'down' },
      { label: 'Accumulating', value: String(acc), tone: 'up' },
      { label: 'Distributing', value: String(dist), tone: 'down' },
    ],
  });
}
