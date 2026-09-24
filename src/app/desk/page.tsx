import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { requestContext } from '@/server/context';
import { DESK_COOKIE, deskScope, deskSummary } from '@/server/desk/calls';
import { DeskView, type DeskData } from '@/components/desk/DeskView';

export const metadata: Metadata = { title: 'Desk — Peregrine' };
export const dynamic = 'force-dynamic';

export default async function DeskPage() {
  const ctx = await requestContext();
  const scope = deskScope(ctx, (await cookies()).get(DESK_COOKIE)?.value ?? null);
  const initial: DeskData = scope ? { scope: scope.split(':')[0], ...deskSummary(scope) } : { scope: null, calls: [], dna: { bySetup: [], byHorizon: [], bySource: [] } };
  return (
    <div className="space-y-4">
      <section aria-labelledby="desk-title" className="glass rise rounded-2xl p-4 sm:p-6">
        <div className="text-[12px] text-ink-muted">See who moved · prove why it matters · remember if you were right</div>
        <h1 id="desk-title" className="mt-1 text-lg font-semibold text-ink sm:text-xl">Desk</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
          Your calls, priced by Nansen at entry and graded from Nansen candles when the horizon passes. Calls can&apos;t be edited.
        </p>
      </section>
      <DeskView initial={initial} />
    </div>
  );
}
