import type { Metadata } from 'next';
import Link from 'next/link';
import { displayMode, viewOf } from '@/server/mode';
import { ResearchAgent } from '@/components/agent/ResearchAgent';
import { weatherMap } from '@/server/weather/queries';
import { alphaBoard } from '@/server/alpha/board';
import { chainName } from '@/lib/viz/format';

export const metadata: Metadata = { title: 'Research agent — TIDE' };
export const dynamic = 'force-dynamic';

/** Starting questions from what TIDE sees right now (no Nansen call). */
function suggestions(view: 'private' | 'public'): string[] {
  const out: string[] = [];
  const chains = weatherMap(Date.now(), view).filter((c) => c.cpi != null).sort((a, b) => b.cpi! - a.cpi!);
  if (chains[0]) out.push(`Why is smart money flowing into ${chainName(chains[0].chain)} right now, and which tokens are they buying?`);
  if (chains.at(-1) && chains.at(-1) !== chains[0]) out.push(`What is driving the outflow from ${chainName(chains.at(-1)!.chain)} this week?`);
  const a = alphaBoard(view, Date.now(), 1).rows[0];
  if (a) out.push(`Who is buying ${a.symbol ?? 'this token'} on ${chainName(a.chain)}, and is the buying from wallets with a good record?`);
  return out;
}

export default async function AgentPage() {
  const mode = await displayMode();
  return (
    <div className="space-y-4">
      <section aria-labelledby="agent-title" className="glass rise rounded-2xl p-4 sm:p-6">
        <div className="text-[12px] text-ink-muted">Nansen agent · expert mode</div>
        <h1 id="agent-title" className="mt-1 text-lg font-semibold text-ink sm:text-xl">Research agent</h1>
        <p className="mt-1 max-w-3xl text-[13.5px] text-ink-2">
          A deep answer from Nansen&apos;s own research agent, which calls Nansen&apos;s data tools and shows which ones. Follow-ups continue the same conversation.
          Each question costs 750 credits on the asking account&apos;s Nansen key, so every question asks you to confirm the price, and each account has a daily cap.
        </p>
      </section>
      {mode === 'public'
        ? <p className="glass rounded-2xl p-4 text-sm text-ink-2">The research agent runs on a Nansen key: this instance&apos;s owner&apos;s, or yours once you <Link href="/account" className="text-ink underline-offset-2 hover:underline">sign in with it</Link>. The weather report on the home page uses Nansen&apos;s fast agent and is free to read.</p>
        : <ResearchAgent suggestions={suggestions(viewOf(mode))} />}
    </div>
  );
}
