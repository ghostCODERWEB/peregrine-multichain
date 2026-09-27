import Link from 'next/link';
import { ShieldAlert, Sparkles, Activity, Target, BadgeCheck, Layers, TrendingUp, TrendingDown, Zap, Brain, Shuffle, MessageCircle, Waypoints } from 'lucide-react';
import { LargeTitle, Group, List, Row, Rail } from '@/components/mobile/kit';
import { SearchPill } from '@/components/mobile/SearchPill';
import { TokenLogo, ChainLogo } from '@/components/Logo';
import { tokenChecker } from '@/server/token/checker';
import { cachedCopyLab } from '@/server/copy/followability';
import { marketPulse } from '@/server/pulse';
import { getDb } from '@/server/nansen/db';
import { chainNets } from '@/lib/viz/net-flow-map';
import { chainName, usd, walletName } from '@/lib/viz/format';
import type { DisplayMode } from '@/server/mode';
import type { ChainTile } from '@/server/weather/bulletin';

const H = 3_600_000;
const SHORTCUTS = [
  { href: '/cascade', label: 'Cascades', Icon: Waypoints, tint: '#1fe0a3' },
  { href: '/alpha', label: 'Alpha', Icon: Sparkles, tint: '#ffd84d' },
  { href: '/smart-money', label: 'Smart Money', Icon: Brain, tint: '#1fe0a3' },
  { href: '/flows', label: 'Chain flows', Icon: Shuffle, tint: '#7cc8ff' },
  { href: '/perps', label: 'Perps', Icon: Activity, tint: '#ff7a1a' },
  { href: '/predict', label: 'Predictions', Icon: Target, tint: '#c49bff' },
  { href: '/sectors', label: 'Sectors', Icon: Layers, tint: '#5ef0c0' },
  { href: '/agent', label: 'Ask Nansen', Icon: MessageCircle, tint: '#9bd5ff' },
];
const pulseIcon = (tone: string) => (tone === 'up' ? <TrendingUp size={16} /> : tone === 'down' ? <TrendingDown size={16} /> : tone === 'alert' ? <Zap size={16} /> : <Activity size={16} />);
const pulseTint = (tone: string) => (tone === 'up' ? 'var(--mint)' : tone === 'down' ? 'var(--flare)' : tone === 'alert' ? 'var(--amber)' : 'var(--signal)');

/** Phones: the Today screen, designed for one hand and a short look, not the desktop overview squeezed down. */
export function MobileHome({ mode, chains }: { mode: DisplayMode; chains: ChainTile[] }) {
  const owner = mode === 'owner';
  const now = Date.now();
  const db = getDb();
  const sm = owner ? db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS w, MAX(traded_at) AS last FROM smart_money_trades WHERE traded_at >= ?`).get(now - 24 * H) as { net: number | null; w: number; last: number | null } : null;
  const hourly = owner ? (db.prepare(`SELECT CAST((traded_at - ?) / ? AS INTEGER) AS h, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE traded_at >= ? GROUP BY h`).all(now - 24 * H, H, now - 24 * H) as Array<{ h: number; net: number }>) : [];
  const bars = Array.from({ length: 24 }, (_, i) => hourly.find((x) => x.h === i)?.net ?? 0);
  const maxBar = Math.max(1, ...bars.map(Math.abs));
  const nets = chainNets(chains).sort((a, b) => b.net - a.net);
  const inflow = nets.filter((n) => n.net > 0).slice(0, 3), outflow = nets.filter((n) => n.net < 0).slice(-3).reverse();
  const risk = owner ? tokenChecker(true) : null;
  const radar = risk ? (risk.smIntoRisk.length ? risk.smIntoRisk.slice(0, 8).map((r) => ({ ...r, kind: 'buying' as const })) : risk.scored.filter((s) => s.score >= 50).slice(0, 8).map((s) => ({ chain: s.chain, address: s.address, symbol: s.symbol, score: s.score, net: 0, buyers: 0, kind: 'score' as const }))) : [];
  const lab = owner ? cachedCopyLab() : null;
  const follow = lab?.wallets.filter((w) => w.score >= 60).slice(0, 5) ?? [];
  const pulse = marketPulse(mode).slice(0, 5);
  const net = sm?.net ?? 0;
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="m-screen">
      <LargeTitle title="Today" caption={date} />
      <SearchPill />

      {/* Hero: the one number to read first. */}
      {/* Owner: Smart Money's 24h DEX net. Public: the all-trader chain with the largest inflow (Smart Money stays private). */}
      <Link prefetch={false} href={sm ? '/smart-money' : '/flows'} className="m-hero">
        <span className="m-hero-label">{sm ? 'Smart Money · 24 hours' : 'All traders · 24 hours'}</span>
        <span className="num m-hero-value" style={{ color: (sm ? net : inflow[0]?.net ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{sm ? usd(net, { signed: true }) : inflow[0] ? usd(inflow[0].net, { signed: true }) : 'n/a'}</span>
        <span className="m-hero-sub">{sm ? `net on DEXs · ${sm.w.toLocaleString('en-US')} wallets` : inflow[0] ? `largest net inflow: ${chainName(inflow[0].chain)} · ${nets.length} chains measured` : 'Chain flows appear after the first scan'}</span>
        {sm && <span className="m-hero-bars" aria-hidden>
          {bars.map((b, i) => <span key={i} style={{ height: `${Math.max(6, (Math.abs(b) / maxBar) * 100)}%`, background: b >= 0 ? 'var(--mint)' : 'var(--flare)', opacity: b === 0 ? 0.18 : 0.35 + 0.65 * (i / 23) }} />)}
        </span>}
        <span className="m-hero-chips">
          {inflow.map((c) => <span key={c.chain} className="m-chip"><ChainLogo chain={c.chain} size={14} />{chainName(c.chain)}<b style={{ color: 'var(--mint)' }}>{usd(c.net, { signed: true })}</b></span>)}
          {outflow.map((c) => <span key={c.chain} className="m-chip"><ChainLogo chain={c.chain} size={14} />{chainName(c.chain)}<b style={{ color: 'var(--flare)' }}>{usd(c.net, { signed: true })}</b></span>)}
        </span>
      </Link>

      {radar.length > 0 && (
        <Group title={radar[0].kind === 'buying' ? 'Smart Money buying into danger' : 'Highest risk right now'} href="/token#sm-risk">
          <Rail label="Risk Radar">
            {radar.map((r) => {
              const danger = r.score >= 55;
              return (
                <Link prefetch={false} role="listitem" key={`${r.chain}:${r.address}`} href={`/token/${r.chain}/${encodeURIComponent(r.address)}`} className="m-card m-risk">
                  <span className="flex items-center justify-between">
                    <TokenLogo symbol={r.symbol} chain={r.chain} address={r.address} size={34} />
                    <span className="m-badge" style={{ color: danger ? 'var(--flare)' : 'var(--amber)', background: `color-mix(in srgb, ${danger ? 'var(--flare)' : 'var(--amber)'} 14%, transparent)` }}><ShieldAlert size={12} />{Math.round(r.score)}</span>
                  </span>
                  <span className="m-card-title">{r.symbol}</span>
                  <span className="m-row-sub">{chainName(r.chain)}</span>
                  <span className="m-card-foot">{r.kind === 'buying' ? <><b style={{ color: 'var(--mint)' }}>+{usd(r.net)}</b> · {r.buyers} SM wallet{r.buyers === 1 ? '' : 's'}</> : danger ? 'Danger' : 'High risk'}</span>
                </Link>
              );
            })}
          </Rail>
        </Group>
      )}

      {follow.length > 0 && (
        <Group title="Worth copying" href="/copy" footer="Followability: what copying their buys returned when you enter an hour late.">
          <List>
            {follow.map((w) => (
              <Row key={w.wallet} href={`/wallet/${w.wallet}`}
                leading={<span className="m-score" style={{ color: w.score >= 65 ? 'var(--mint)' : 'var(--amber)' }}>{w.score}</span>}
                title={walletName(w.label, w.wallet)} subtitle={`${w.tokens} tokens · win ${Math.round(w.win[2] * 100)}% an hour late`}
                trailing={`${w.median[2] >= 0 ? '+' : ''}${(w.median[2] * 100).toFixed(0)}%`} trailingSub="1h late" tone={w.median[2] >= 0 ? 'in' : 'out'} />
            ))}
          </List>
        </Group>
      )}

      <Group title="Explore">
        <div className="m-grid">
          {SHORTCUTS.map(({ href, label, Icon, tint }) => (
            <Link prefetch={false} key={href} href={href} className="m-tile">
              <span className="m-tile-icon" style={{ color: tint, background: `color-mix(in srgb, ${tint} 16%, transparent)` }}><Icon size={20} /></span>
              <span className="m-tile-label">{label}</span>
            </Link>
          ))}
        </div>
      </Group>

      {pulse.length > 0 && (
        <Group title="Signals">
          <List>
            {pulse.map((p) => (
              <Row key={p.id} href={p.href}
                leading={<span className="m-icon" style={{ color: pulseTint(p.tone), background: `color-mix(in srgb, ${pulseTint(p.tone)} 15%, transparent)` }}>{pulseIcon(p.tone)}</span>}
                title={p.text.replace(/\p{Extended_Pictographic}|️/gu, '').trim()} subtitle={`${p.kind} · ${p.detail}`} />
            ))}
          </List>
        </Group>
      )}

      <Group title="Where money is moving" href="/flows">
        <List>
          {nets.slice(0, 3).concat(nets.slice(-2)).filter((c, i, a) => a.findIndex((x) => x.chain === c.chain) === i).map((c) => (
            <Row key={c.chain} href={`/chain/${c.chain}`} leading={<ChainLogo chain={c.chain} size={26} />} title={chainName(c.chain)}
              subtitle={c.net >= 0 ? 'net inflow, 24h' : 'net outflow, 24h'} trailing={usd(c.net, { signed: true })} tone={c.net >= 0 ? 'in' : 'out'} />
          ))}
        </List>
      </Group>

      <Group>
        <Link prefetch={false} href="/proof" className="m-proof"><BadgeCheck size={16} />Every number here is read from Nansen. See the proof</Link>
      </Group>
    </div>
  );
}
