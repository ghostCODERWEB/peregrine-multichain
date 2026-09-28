import { ogCard, OG_SIZE } from '@/lib/og/card';
import { buildBulletin } from '@/server/weather/bulletin';
import { mapHeadline } from '@/lib/insights';
import { chainNets } from '@/lib/viz/net-flow-map';
import { chainName, usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Peregrine: smart-money intelligence for every chain, built on the Nansen API';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** The overview's card: the day's headline and the largest moves, from the scanner's stored readings (public view). */
export default function Image() {
  const b = buildBulletin('public'); // share images leave the app: always the public view
  const nets = chainNets(b.chains).sort((x, y) => y.net - x.net);
  const inflow = nets.find((n) => n.net > 0), outflow = [...nets].reverse().find((n) => n.net < 0);
  const measured = b.chains.filter((c) => c.cpi != null).length;
  return ogCard({
    section: 'Overview',
    // The overview's own hero line, so the card and the page say the same thing.
    title: inflow && outflow ? `Buying ${chainName(inflow.chain)}. Selling ${chainName(outflow.chain)}.` : mapHeadline(b.chains, b.fronts),
    subtitle: 'Where capital is moving across every chain the Nansen API covers, and the tokens at risk.',
    stats: [
      { label: inflow ? `Largest inflow · ${chainName(inflow.chain)}` : 'Largest inflow', value: inflow ? usd(inflow.net, { signed: true }) : 'n/a', tone: 'up' },
      { label: outflow ? `Largest outflow · ${chainName(outflow.chain)}` : 'Largest outflow', value: outflow ? usd(outflow.net, { signed: true }) : 'n/a', tone: 'down' },
      { label: 'Chains measured', value: `${measured} of ${b.chains.length}` },
      { label: 'Dump-risk alerts', value: String(b.storms.length), tone: b.storms.length ? 'warn' : 'plain' },
    ],
  });
}
