import { Card, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { TimeAgo } from '@/components/TimeAgo';
import { WalletStyleEvidence } from '@/components/wallet/WalletStyleEvidence';
import { chainName, pct, usd } from '@/lib/viz/format';
import { isUnavailable, type Wave } from '@/server/nansen/traced';
import type { WalletWeatherReading } from '@/server/wallet/weather';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const width = (v: number | null) => `${Math.max(0, Math.min(100, (v ?? 0) * 100))}%`;

function EvidenceBar({
  label,
  value,
  detail,
  tone = 'var(--brand)',
}: {
  label: string;
  value: number | null;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[9.5rem_1fr_8.5rem] sm:items-center sm:gap-3">
      <span className="text-[12px] text-ink-2">{label}</span>
      <div
        className="h-2 overflow-hidden rounded-full bg-accent"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value == null ? undefined : Math.round(value * 100)}
      >
        {value != null && <span className="block h-full rounded-full" style={{ width: width(value), background: tone }} />}
      </div>
      <span className="num text-left text-[11.5px] text-ink sm:text-right">{detail}</span>
    </div>
  );
}

export async function WalletWeather({ p }: { p: Promise<Wave<WalletWeatherReading>> }) {
  const r = await p;
  if (isUnavailable(r))
    return (
      <Card id="wallet-weather" title="Wallet profile">
        <Unavailable text={r.unavailable} />
      </Card>
    );
  const w = r.profile;
  const primary = cap(w.style.primary);
  const stormDetail = w.storm.score == null ? 'No fresh score' : `${w.storm.score.toFixed(0)} / 100`;
  const coverageDetail =
    w.storm.coverage == null
      ? 'No risk assets'
      : `${pct(w.storm.coverage, 0)} · ${w.storm.positions} token${w.storm.positions === 1 ? '' : 's'}`;

  return (
    <Card
      id="wallet-weather"
      title={`${w.headline}, ${primary.toLowerCase()} pattern`}
      sub="A current spot-risk profile and 30-day realized-activity pattern. Each dimension stays separate; unknown data is never scored as safe."
      action={<InfoPopover p={r.provenance} />}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,.75fr)]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
            <span>
              {w.positionCount} priced position{w.positionCount === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>{w.effectivePositions.toFixed(1)} effective</span>
            {w.storm.freshestAt && (
              <>
                <span>·</span>
                <span>
                  Risk refreshed <TimeAgo ts={w.storm.freshestAt} />
                </span>
              </>
            )}
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-accent/25 p-3.5 sm:p-4">
            <EvidenceBar
              label="Largest position"
              value={w.largestPosition?.share ?? null}
              detail={w.largestPosition ? `${pct(w.largestPosition.share, 0)} · ${w.largestPosition.symbol}` : 'Unavailable'}
              tone="var(--storm-2)"
            />
            <EvidenceBar
              label="Largest chain"
              value={w.largestChain?.share ?? null}
              detail={w.largestChain ? `${pct(w.largestChain.share, 0)} · ${chainName(w.largestChain.chain)}` : 'Unavailable'}
              tone="var(--brand-2)"
            />
            <EvidenceBar
              label="Stable buffer"
              value={w.stableShare}
              detail={`${pct(w.stableShare, 0)} · ${usd(w.stableUsd)}`}
              tone="var(--brand)"
            />
            <EvidenceBar
              label="Dump Risk"
              value={w.storm.score == null ? null : w.storm.score / 100}
              detail={stormDetail}
              tone="var(--storm-3)"
            />
            <EvidenceBar label="Risk coverage" value={w.storm.coverage} detail={coverageDetail} tone="var(--out-3)" />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Observed style evidence</h3>
            <span className="text-[11px] text-ink-2">Primary: {primary}</span>
          </div>
          <WalletStyleEvidence
            trader={w.style.trader}
            holder={w.style.holder}
            exits={w.style.activity.exits}
            tradedTokens={w.style.activity.tradedTokens}
            positionCount={w.positionCount}
            effectivePositions={w.effectivePositions}
            spotUsd={w.totalUsd}
          />
        </div>
      </div>

      <details className="mt-4 border-t border-border/70 pt-3 text-[11.5px]">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">Exact exposure table</summary>
        <div tabIndex={0} role="region" aria-label="Wallet profile table" className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left">
            <thead className="text-[10px] uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="pb-1 font-normal">Dimension</th>
                <th className="pb-1 font-normal">Value</th>
                <th className="pb-1 font-normal">Denominator / scope</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              <tr className="border-t border-border/60">
                <td className="py-1">Largest position</td>
                <td className="num py-1">{pct(w.largestPosition?.share, 1)}</td>
                <td className="py-1">
                  {w.largestPosition
                    ? `${usd(w.largestPosition.valueUsd)} ${w.largestPosition.symbol} / ${usd(w.totalUsd)} priced spot`
                    : 'Unavailable'}
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1">Largest chain</td>
                <td className="num py-1">{pct(w.largestChain?.share, 1)}</td>
                <td className="py-1">
                  {w.largestChain
                    ? `${usd(w.largestChain.valueUsd)} on ${chainName(w.largestChain.chain)} / ${usd(w.totalUsd)} priced spot`
                    : 'Unavailable'}
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1">Stable buffer</td>
                <td className="num py-1">{pct(w.stableShare, 1)}</td>
                <td className="py-1">
                  {usd(w.stableUsd)} stables / {usd(w.totalUsd)} priced spot
                </td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1">Risk exposure</td>
                <td className="num py-1">{w.storm.score == null ? 'n/a' : w.storm.score.toFixed(1)}</td>
                <td className="py-1">Value-weighted over {usd(w.storm.coveredUsd)} fresh scored risk assets</td>
              </tr>
              <tr className="border-t border-border/60">
                <td className="py-1">Risk coverage</td>
                <td className="num py-1">{pct(w.storm.coverage, 1)}</td>
                <td className="py-1">
                  {usd(w.storm.coveredUsd)} scored / {usd(w.riskUsd)} non-stable
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
