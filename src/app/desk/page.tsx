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
        <p className="mt-1 max-w-3xl text-[13.5px] text-ink-2">
          Every call you make on a token page lands here with the price Nansen reported at that moment and what Peregrine read then. When the horizon passes, the call is graded from Nansen&apos;s candles for exactly that window, and your hit rate builds up by setup and horizon.
          {initial.scope === 'desk' ? ' This desk lives in this browser (an anonymous cookie); sign in to keep it with your account.' : ''}
        </p>
      </section>
      <DeskView initial={initial} />
    </div>
  );
}
