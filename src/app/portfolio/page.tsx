import type { Metadata } from 'next';
import { PortfolioView } from '@/components/portfolio/PortfolioView';
import { getDb } from '@/server/nansen/db';
import { displayMode } from '@/server/mode';
export const metadata: Metadata = { title: 'Portfolio observatory · Peregrine' };
export const dynamic = 'force-dynamic';

/** Owner view: the five Smart Money wallets that moved most in 24h, as a one-click starting set. */
function suggestions() {
  return getDb().prepare(`SELECT wallet AS address, MAX(wallet_label) AS label FROM smart_money_trades WHERE traded_at >= ? AND wallet LIKE '0x%' GROUP BY wallet ORDER BY SUM(usd_value) DESC LIMIT 5`)
    .all(Date.now() - 86_400_000) as Array<{ address: string; label: string | null }>;
}

export default async function PortfolioPage() {
  const owner = (await displayMode()) === 'owner';
  return <PortfolioView demo={process.env.DEMO_MODE === '1'} suggestions={owner ? suggestions() : []} />;
}
