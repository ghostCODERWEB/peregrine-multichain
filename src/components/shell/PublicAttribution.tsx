import { displayMode } from '@/server/mode';

/** Nansen's Data Redistribution Guidelines: data shown to the public carries a visible Nansen attribution.
 *  Shown on public views only; the key owner's own view (internal use) stays unchanged. */
export async function PublicAttribution() {
  if ((await displayMode()) !== 'public') return null;
  return (
    <p className="mt-10 text-center text-[12px] text-ink-muted">
      Public view ·{' '}
      <a href="https://www.nansen.ai" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">
        Powered by Nansen API
      </a>
    </p>
  );
}
