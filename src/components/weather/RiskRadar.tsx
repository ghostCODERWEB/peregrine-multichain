import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { TokenLogo } from '@/components/Logo';
import { tokenChecker } from '@/server/token/checker';
import { chainName, usd } from '@/lib/viz/format';
import type { DisplayMode } from '@/server/mode';

const SITE = 'https://peregrine-nansen.up.railway.app';
const band = (s: number) => (s >= 55 ? { word: 'Danger', color: 'var(--flare)' } : { word: 'Watch', color: 'var(--amber)' });

/** Risk Radar: Smart Money net buying, in the last 24h, into tokens whose Token Score reads 50 or more.
 *  The product's lead signal, one tap from each token's verdict and one tap from a share. */
export function RiskRadar({ mode }: { mode: DisplayMode }) {
  if (mode !== 'owner') return null;
  const d = tokenChecker(true);
  const rows = d.smIntoRisk.slice(0, 6);
  const fallback = rows.length ? [] : d.scored.filter((s) => s.score >= 50).slice(0, 4);
  return (
    <section aria-labelledby="risk-radar" className="material p-4 sm:p-5 xl:col-span-12" style={{ boxShadow: 'inset 3px 0 0 var(--flare)' }}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="risk-radar" className="t-section flex items-center gap-2"><ShieldAlert size={18} style={{ color: 'var(--flare)' }} aria-hidden />Risk Radar: Smart Money buying into danger</h2>
        <span className="text-[12px] text-ink-muted">Net Smart Money buys, 24h, into tokens with a Token Score of 50+</span>
      </div>
      {rows.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const b = band(r.score);
            const href = `/token/${r.chain}/${encodeURIComponent(r.address)}`;
            const share = `https://x.com/intent/post?text=${encodeURIComponent(`Smart Money bought ${usd(r.net)} of $${r.symbol} on ${chainName(r.chain)} in 24h, while its Token Score reads ${Math.round(r.score)}/100 (${b.word}). Flagged by Peregrine on @nansen_ai data.`)}&url=${encodeURIComponent(`${SITE}${href}`)}`;
            return (
              <li key={`${r.chain}:${r.address}`} className="inset-well flex items-center gap-3 rounded-[14px] p-3">
                <TokenLogo symbol={r.symbol} chain={r.chain} address={r.address} size={30} />
                <Link href={href} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[14px] font-bold text-ink">{r.symbol} <span className="text-[11.5px] font-normal text-ink-muted">{chainName(r.chain)}</span></span>
                  <span className="num block truncate text-[12px] text-ink-2"><span style={{ color: 'var(--mint)' }}>+{usd(r.net)}</span> by {r.buyers} Smart Money wallet{r.buyers === 1 ? '' : 's'}</span>
                </Link>
                <span className="text-right">
                  <span className="num block text-[18px] font-extrabold leading-none" style={{ color: b.color }}>{Math.round(r.score)}</span>
                  <span className="block text-[10.5px] font-bold uppercase" style={{ color: b.color }}>{b.word}</span>
                </span>
                <a href={share} target="_blank" rel="noopener noreferrer" aria-label={`Share ${r.symbol} on X`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--hair)] text-ink-muted hover:text-ink">
                  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden fill="currentColor"><path d="M18.9 2H22l-7.5 8.6L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8-9.2L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" /></svg>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-[12.5px] text-ink-2">
          <p>No Smart Money net buying into High-risk tokens in the last 24 hours.{fallback.length ? ' Highest Token Scores right now:' : ''}</p>
          {fallback.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {fallback.map((s) => <li key={`${s.chain}:${s.address}`}><Link href={`/token/${s.chain}/${encodeURIComponent(s.address)}`} className="inset-well inline-flex items-center gap-2 rounded-full px-3 py-1.5 hover:underline"><TokenLogo symbol={s.symbol} chain={s.chain} address={s.address} size={16} /><span className="font-semibold text-ink">{s.symbol}</span><span className="num font-bold" style={{ color: band(s.score).color }}>{Math.round(s.score)}</span></Link></li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
