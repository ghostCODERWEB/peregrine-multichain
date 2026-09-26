import { COHORT_NAME, type Cohort } from '@/lib/perps/positions';

const SHORT: Record<Cohort, string> = { smart_money: 'SM', whale: 'Whale', public_figure: 'Public' };
const TIP: Record<Cohort, string> = {
  smart_money: 'Nansen Smart Money: wallets Nansen classifies by historical trading performance',
  whale: 'Nansen whale: a large holder by Nansen\'s classification',
  public_figure: 'Public figure: a publicly identified trader in Nansen\'s labels',
};

/** Nansen's cohort for a wallet, as a quiet badge with its definition on hover. */
export function CohortBadges({ cohorts }: { cohorts: Cohort[] }) {
  if (!cohorts.length) return null;
  return (
    <span className="inline-flex shrink-0 gap-1">
      {cohorts.map((c) => (
        <span key={c} title={TIP[c]} aria-label={COHORT_NAME[c]}
          className={`rounded-[5px] px-1.5 py-px text-[10.5px] font-bold leading-4 ${c === 'smart_money' ? 'bg-[color-mix(in_srgb,var(--signal)_18%,transparent)] text-[var(--signal)]' : 'bg-ink/10 text-ink-2'}`}>
          {SHORT[c]}
        </span>
      ))}
    </span>
  );
}
