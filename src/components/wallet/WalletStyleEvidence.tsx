'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { farmerStyle, perpStyle, type StyleLevel, type WalletWeatherEnrichment } from '@/lib/models/wallet-weather';
import { usd } from '@/lib/viz/format';

const levelTone: Record<StyleLevel, string> = {
  high: 'border-brand/30 bg-brand/10 text-brand',
  moderate: 'border-brand-2/30 bg-brand-2/10 text-ink',
  light: 'border-border bg-accent/55 text-ink-2',
};

function StyleTile({ name, level, testId, children }: { name: string; level?: StyleLevel; testId: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-accent/35 p-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-medium text-ink">{name}</h3>
        {level
          ? <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${levelTone[level]}`}>{level}</span>
          : <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">not assessed</span>}
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

export function WalletStyleEvidence({ trader, holder, exits, tradedTokens, positionCount, effectivePositions, spotUsd }: {
  trader: StyleLevel; holder: StyleLevel; exits: number; tradedTokens: number; positionCount: number; effectivePositions: number; spotUsd: number;
}) {
  const [farmer, setFarmer] = useState<Extract<WalletWeatherEnrichment, { kind: 'farmer' }> | null>(null);
  const [perp, setPerp] = useState<Extract<WalletWeatherEnrichment, { kind: 'perp' }> | null>(null);
  useEffect(() => {
    const onEvidence = (event: Event) => {
      const evidence = (event as CustomEvent<WalletWeatherEnrichment>).detail;
      if (evidence.kind === 'farmer') setFarmer(evidence);
      if (evidence.kind === 'perp') setPerp(evidence);
    };
    window.addEventListener('tide:wallet-weather', onEvidence);
    return () => window.removeEventListener('tide:wallet-weather', onEvidence);
  }, []);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
      <StyleTile name="Trader" level={trader} testId="wallet-style-trader">
        {exits} realized exit{exits === 1 ? '' : 's'} across {tradedTokens} token{tradedTokens === 1 ? '' : 's'} in 30 days.
      </StyleTile>
      <StyleTile name="Holder" level={holder} testId="wallet-style-holder">
        {positionCount} current position{positionCount === 1 ? '' : 's'}, equivalent to {effectivePositions.toFixed(1)} equally sized positions.
      </StyleTile>
      <StyleTile name="Farmer" level={farmer ? farmerStyle(farmer, spotUsd) : undefined} testId="wallet-style-farmer">
        {farmer
          ? `${farmer.protocols} protocol${farmer.protocols === 1 ? '' : 's'} with ${usd(farmer.valueUsd)} net DeFi value reported by Nansen.`
          : <>DeFi protocol positions are not auto-loaded. <Link href="#wallet-desk" className="text-ink underline decoration-border underline-offset-2 hover:decoration-ink">Load DeFi in Wallet desk</Link> to assess them.</>}
      </StyleTile>
      <StyleTile name="Perp" level={perp ? perpStyle(perp) ?? undefined : undefined} testId="wallet-style-perp">
        {perp
          ? `${perp.openPositions == null ? 'Unknown open positions' : `${perp.openPositions} open position${perp.openPositions === 1 ? '' : 's'}`}, ${perp.fills30d == null ? 'unknown fills' : `${perp.fills30d} fill${perp.fills30d === 1 ? '' : 's'}`} and ${perp.closedTrades30d == null ? 'unknown closed trades' : `${perp.closedTrades30d} closed trade${perp.closedTrades30d === 1 ? '' : 's'}`} in 30 days.`
          : <>Perpetual positions are not assumed absent. <Link href="#wallet-desk" className="text-ink underline decoration-border underline-offset-2 hover:decoration-ink">Load Hyperliquid in Wallet desk</Link> to assess them.</>}
      </StyleTile>
    </div>
  );
}
