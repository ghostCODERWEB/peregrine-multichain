import type { Metadata } from 'next';
import Link from 'next/link';
import { displayMode, viewOf } from '@/server/mode';
import { ResearchAgent } from '@/components/agent/ResearchAgent';
import { ResearchDesk } from '@/components/agent/ResearchDesk';
import { listReports } from '@/server/research/desk';
import { weatherMap } from '@/server/weather/queries';
import { alphaBoard } from '@/server/alpha/board';
import { chainName } from '@/lib/viz/format';
import { accountsEnabled } from '@/server/site';
import { PageTitle } from '@/components/PageTitle';

export const metadata: Metadata = { title: 'Ask · Peregrine' };
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

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const mode = await displayMode();
  const tab = (await searchParams).tab === 'expert' ? 'expert' : 'desk';
  const tabs = (
    <nav aria-label="Ask views" className="segmented" style={{ '--segments': 2, '--selected': tab === 'desk' ? 0 : 1 } as React.CSSProperties}>
      <span className="segmented-thumb" aria-hidden />
      <Link href="/agent" aria-current={tab === 'desk' ? 'page' : undefined} className={`relative z-[1] px-4 py-1.5 text-center text-[12.5px] font-bold ${tab === 'desk' ? 'text-ink' : 'text-ink-muted'}`}>Research Desk</Link>
      <Link href="/agent?tab=expert" aria-current={tab === 'expert' ? 'page' : undefined} className={`relative z-[1] px-4 py-1.5 text-center text-[12.5px] font-bold ${tab === 'expert' ? 'text-ink' : 'text-ink-muted'}`}>Nansen Expert</Link>
    </nav>
  );
  return (
    <div className="space-y-4">
      <PageTitle id="agent-title" title="Ask" pill={tab === 'desk' ? 'Research with evidence: Peregrine analytics + Nansen AI' : 'Nansen agent, expert mode · 750 credits a question'} action={mode === 'public' ? undefined : tabs} />
      {mode === 'public'
        ? <p className="material p-5 text-sm text-ink-2">Ask runs on a Nansen key: this instance&apos;s owner&apos;s{accountsEnabled() ? <>, or yours once you <Link href="/account" className="text-ink underline underline-offset-2">sign in with it</Link></> : null}. The market brief on the home page uses Nansen&apos;s fast agent and is free to read.</p>
        : tab === 'desk' ? <ResearchDesk initialReports={listReports()} /> : <ResearchAgent suggestions={suggestions(viewOf(mode))} />}
    </div>
  );
}
