'use client';
import { VerdictCard } from '@/components/token/VerdictCard';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSite } from '@/components/SiteContext';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { StormDial, stormTitle } from './StormDial';
import { CandleChart, marketTitle } from './CandleChart';
import { WindRose, windTitle } from './WindRose';
import { BuyersSellers, tradersTitle } from './BuyersSellers';
import { HolderPanel, holdersTitle } from './HolderPanel';
import { InsiderGraph, forensicsTitle } from './InsiderGraph';
import { OddsCard, oddsTitle } from './OddsCard';
import type { ForecastWave } from '@/server/token/forecast';
import { chainName } from '@/lib/viz/format';
import type { Wave, TokenHeader, MarketWave, WindWave, HoldersWave, ForensicsWave } from '@/server/token/waves';
import type { StormWave, StormCandidate } from '@/server/token/storm';
import type { TapeWave, RiverWave, SocialWave, DcaWave, PositionsWave, PnlBoardWave, LeverageWave } from '@/server/token/terminal';
import {
  LiveTape,
  tapeTitle,
  TransferRiver,
  riverTitle,
  SocialPulse,
  socialTitle,
  DcaLadder,
  dcaTitle,
  TideGauge,
  positionsTitle,
  PnlBoard,
  NewsCards,
} from './Terminal';
import { num } from '@/lib/viz/format';
import dynamic from 'next/dynamic';
// Below the fold: loaded on demand to keep the token route's first-load JS in budget.
const TokenAskChat = dynamic(() => import('@/components/agent/TokenAskChat').then((m) => m.TokenAskChat), {
  ssr: false,
  loading: () => <div className="material min-h-[320px] animate-pulse" aria-hidden />,
});
// Owner-only tools: never shipped in the first load a public visitor downloads.
const StormAlertForm = dynamic(() => import('./StormAlertForm').then((m) => m.StormAlertForm), { ssr: false });
const RideCard = dynamic(() => import('./RideCard').then((m) => m.RideCard), { ssr: false });
import { TokenActions } from './TokenActions';
import { STORM_LABEL } from '@/lib/viz/scales';
import { TokenHero, LiquidationLadder, leverageTitle, CohortBars } from './Visuals';
import { HolderSphere } from './HolderSphere';
import type { ReactNode } from 'react';
import { CallForm } from '@/components/desk/CallForm';
import { Gauges, gaugesTitle, gaugeReadings } from './Gauges';
import type { GaugeInputs } from '@/lib/models/gauges';
import { FollowThrough, followTitle } from './FollowThrough';
import type { FollowReport } from '@/server/smart-money/follow';
import { AskNansen } from '@/components/agent/AskNansen';
import { Go } from '@/components/ui/Icons';

interface State {
  header?: Wave<TokenHeader>;
  market?: Wave<MarketWave>;
  wind?: Wave<WindWave>;
  holders?: Wave<HoldersWave>;
  forensics?: Wave<ForensicsWave>;
  storm?: Wave<StormWave>;
  forecast?: Wave<ForecastWave>;
  tape?: Wave<TapeWave>;
  river?: Wave<RiverWave>;
  social?: Wave<SocialWave>;
  dca?: Wave<DcaWave>;
  positions?: Wave<PositionsWave>;
  pnlboard?: Wave<PnlBoardWave>;
  leverage?: Wave<LeverageWave>;
  candidates?: StormCandidate[];
  done?: { calls: number; credits: number; cached: number };
  fatal?: string;
}

const WAVES = [
  'header',
  'market',
  'forecast',
  'wind',
  'holders',
  'forensics',
  'storm',
  'tape',
  'river',
  'social',
  'dca',
  'positions',
  'pnlboard',
  'leverage',
  'candidates',
  'done',
  'fatal',
] as const;
const gone = <T,>(w: Wave<T> | undefined): w is { unavailable: string } => !!w && typeof w === 'object' && 'unavailable' in w;
const ok = <T,>(w: Wave<T> | undefined): w is T => !!w && !gone(w);

function useTokenStream(chain: string, address: string): State {
  const [s, setS] = useState<State>({});
  useEffect(() => {
    setS({});
    const es = new EventSource(`/api/token/${chain}/${encodeURIComponent(address)}/stream`);
    for (const name of WAVES) {
      es.addEventListener(name, (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setS((prev) => ({ ...prev, [name]: name === 'fatal' ? data.message : data }));
        if (name === 'done' || name === 'fatal') es.close();
      });
    }
    // EventSource retries on its own; a failure before `done` means the
    // stream broke, so stop and say so instead of silently reconnecting
    // (each retry would re-spend credits on uncached calls).
    es.onerror = () => {
      es.close();
      setS((prev) => (prev.done ? prev : { ...prev, fatal: prev.fatal ?? 'The stream from the server was interrupted.' }));
    };
    return () => es.close();
  }, [chain, address]);
  return s;
}

const WITHHELD =
  'Shown to the API key owner or a signed-in member with their own key: it is built from Nansen labels, which Nansen\u2019s redistribution rules keep out of public views.';

type View = 'overview' | 'flow' | 'holders' | 'leverage' | 'terminal' | 'all';
const VIEWS: Array<[View, string]> = [
  ['overview', 'Overview'],
  ['flow', 'Flow'],
  ['holders', 'Holders'],
  ['leverage', 'Leverage'],
  ['terminal', 'Terminal'],
  ['all', 'All'],
];

// Each view is rows of cards; a number after the key is its column span.
type Row = { cols: 2 | 3; items: Array<[string, number?]> };
const LAYOUT: Record<View, Row[]> = {
  overview: [
    { cols: 3, items: [['ask', 2], ['traders']] },
    { cols: 2, items: [['gauges', 2]] },
    { cols: 3, items: [['sphere', 2], ['cohorts']] },
    { cols: 3, items: [['odds'], ['leverage', 2]] },
  ],
  flow: [
    { cols: 3, items: [['cohorts'], ['wind'], ['traders']] },
    { cols: 2, items: [['follow', 2]] },
    { cols: 3, items: [['market', 2], ['river']] },
    { cols: 2, items: [['dca'], ['social']] },
  ],
  holders: [
    { cols: 3, items: [['sphere', 2], ['traders']] },
    { cols: 2, items: [['holders'], ['insiders']] },
    { cols: 2, items: [['pnlboard', 2]] },
  ],
  leverage: [
    { cols: 3, items: [['leverage', 2], ['positions']] },
    { cols: 3, items: [['market', 2], ['dca']] },
  ],
  terminal: [
    { cols: 3, items: [['tape', 2], ['river']] },
    { cols: 3, items: [['social'], ['dca'], ['positions']] },
    { cols: 2, items: [['pnlboard'], ['news']] },
  ],
  all: [
    { cols: 3, items: [['storm'], ['market', 2]] },
    { cols: 3, items: [['gauges', 3]] },
    { cols: 3, items: [['sphere', 2], ['cohorts']] },
    { cols: 3, items: [['odds'], ['wind'], ['traders']] },
    { cols: 2, items: [['follow', 2]] },
    { cols: 2, items: [['holders'], ['insiders']] },
    { cols: 3, items: [['leverage', 2], ['positions']] },
    { cols: 3, items: [['tape', 2], ['river']] },
    { cols: 2, items: [['social'], ['dca']] },
    { cols: 2, items: [['pnlboard'], ['news']] },
    { cols: 2, items: [['ask', 2]] },
  ],
};
const SPAN: Record<number, string> = { 2: 'lg:col-span-2', 3: 'lg:col-span-3' };

function useView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>('overview');
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v && VIEWS.some(([k]) => k === v)) setView(v as View);
  }, []);
  const set = (v: View) => {
    setView(v);
    const u = new URL(window.location.href);
    if (v === 'overview') u.searchParams.delete('view');
    else u.searchParams.set('view', v);
    window.history.replaceState(null, '', u);
  };
  return [view, set];
}

export function TokenView({
  chain,
  address,
  tier,
  mode,
  quickRead,
  smEvents,
  extra,
}: {
  chain: string;
  address: string;
  tier: string;
  mode: 'owner' | 'member' | 'public';
  quickRead?: React.ReactNode;
  smEvents?: import('./CandleChart').SmEvent[];
  extra?: React.ReactNode;
}) {
  const s = useTokenStream(chain, address);
  const { accounts } = useSite();
  const [view, setView] = useView();
  const [followReport, setFollowReport] = useState<FollowReport | null>(null);
  // "/ask TOKEN" (L5) lands here with ?ask=1: open the panel once, after mount.
  const [autoAsk, setAutoAsk] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ask') === '1') setAutoAsk(true);
  }, []);
  const h = ok(s.header) ? s.header : null;
  const symbol = h?.symbol ?? null;
  const clustered = useMemo(
    () =>
      new Set(
        ok(s.forensics)
          ? s.forensics.clusters.filter((c) => c.wallets.length >= 2).flatMap((c) => c.wallets.map((w) => w.toLowerCase()))
          : [],
      ),
    [s.forensics],
  );
  const pending = (w: unknown) => w === undefined && !s.fatal;
  const title = ok(s.storm)
    ? stormTitle(symbol, s.storm)
    : h
      ? `${h.name ?? h.symbol} on ${chainName(chain)}`
      : gone(s.header)
        ? `Token on ${chainName(chain)}`
        : 'Reading the token from Nansen…';

  const gaugeInputs: GaugeInputs = {
    rings: ok(s.wind) ? s.wind.rings : null,
    liquidityUsd: h?.liquidityUsd ?? null,
    volume24hUsd: h?.volume24hUsd ?? null,
    buyVolumeUsd: h?.buyVolumeUsd ?? null,
    sellVolumeUsd: h?.sellVolumeUsd ?? null,
    clusters: ok(s.forensics)
      ? s.forensics.clusters.map((c) => ({ share: c.share, wallets: c.wallets.length, includesDeployer: c.includesDeployer }))
      : gone(s.forensics)
        ? []
        : null,
    clusteredHolderCount: ok(s.forensics) ? s.forensics.clusteredHolderCount : gone(s.forensics) ? 0 : null,
    comparedHolders: ok(s.forensics) ? s.forensics.nodes.length : gone(s.forensics) ? 0 : null,
  };
  const cards: Record<string, (cls: string) => ReactNode> = {
    follow: (cls) => (
      <Card
        id="follow"
        className={cls}
        title={followTitle(followReport)}
        sub="After a smart-money buy, did other wallets buy faster in the next 10 minutes, and where was the price 24 hours later?"
      >
        <FollowThrough chain={chain} token={address} mode={mode} onReport={setFollowReport} />
      </Card>
    ),
    gauges: (cls) => (
      <Card
        id="gauges"
        className={cls}
        title={gaugesTitle(gaugeInputs)}
        sub="Who is on which side, how much evidence there is, and whether the holders move as one. Three readings, never one score."
      >
        {gone(s.wind) && gone(s.header) ? (
          <Unavailable text={s.wind.unavailable} />
        ) : pending(s.wind) && pending(s.header) ? (
          <WaveLoading what="flows for the three gauges" height={220} />
        ) : (
          <Gauges
            inputs={gaugeInputs}
            ladder={ok(s.leverage) ? s.leverage.ladder : null}
            sources={{
              wind: ok(s.wind) ? s.wind.provenance : null,
              header: h?.provenance ?? null,
              forensics: ok(s.forensics) ? s.forensics.provenance : null,
              leverage: ok(s.leverage) ? s.leverage.provenance : null,
            }}
          />
        )}
      </Card>
    ),
    call: (cls) => (
      <Card
        id="call"
        className={cls}
        title={`Make a call on ${symbol ?? 'this token'}`}
        sub="Bull, bear or pass, a horizon, and what would prove you wrong. Saved to your Desk with Nansen’s price now, graded when the horizon passes."
        action={
          <AskNansen
            subject={{ kind: 'token', chain, address }}
            label={`${symbol ?? 'this token'} on ${chainName(chain)}`}
            autoOpen={autoAsk}
            buttonClassName="rounded border border-border px-2.5 py-1 text-[11.5px] text-ink-2 hover:text-ink hover:border-ink-muted"
          />
        }
      >
        <CallForm
          chain={chain}
          token={address}
          symbol={symbol}
          price={ok(s.market) ? (s.market.candles.at(-1)?.c ?? null) : null}
          gauges={gaugeReadings(gaugeInputs)}
        />
      </Card>
    ),
    storm: (cls) => (
      <Card
        id="storm"
        className={cls}
        title={ok(s.storm) ? `Token Score: ${Math.round(s.storm.result.score)} of 100` : 'Token Score'}
        sub="Probability-style dump-risk score from six Nansen-derived inputs."
      >
        {ok(s.storm) ? (
          <StormDial s={s.storm} indicators={[...(h?.risk ?? []), ...(h?.reward ?? [])]} />
        ) : gone(s.storm) ? (
          <Unavailable text={s.storm.unavailable} />
        ) : pending(s.storm) ? (
          <WaveLoading what="the Token Score inputs" height={420} />
        ) : null}
        {s.candidates && (
          <div className="mt-3 border-t border-border pt-2">
            <div className="text-[11px] text-ink-muted">Token Score v2 candidates · not yet in the score</div>
            <ul className="mt-1 flex flex-wrap gap-2">
              {s.candidates.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-[12px]"
                  title={c.why ?? undefined}
                >
                  <span className="text-ink-2">{c.name}</span>
                  <span className="num text-ink">{c.score == null ? 'n/a' : num(c.score, 0)}</span>
                  {c.provenance && <InfoPopover p={c.provenance} />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    ),
    market: (cls) => (
      <Card
        id="market"
        className={cls}
        title={ok(s.market) ? marketTitle(symbol, s.market) : 'Price and flow'}
        sub="4-hour candles over 14 days with an 80% volatility cone 7 days ahead; below, the labelled holder segment's daily net flow."
      >
        {ok(s.market) ? (
          <CandleChart m={s.market} />
        ) : gone(s.market) ? (
          <Unavailable text={s.market.unavailable} />
        ) : pending(s.market) ? (
          <WaveLoading what="candles" height={360} />
        ) : null}
      </Card>
    ),
    sphere: (cls) => (
      <Card
        id="sphere"
        className={cls}
        title={ok(s.holders) ? sphereTitle(s.holders.holders.length, clustered.size, ok(s.forensics)) : 'Holder constellation'}
        sub="The top holders on a sphere, sized by share of supply, linked where Nansen shows a shared first funder, related wallets or a transfer between them today."
      >
        {ok(s.holders) ? (
          <HolderSphere holders={s.holders.holders} forensics={ok(s.forensics) ? s.forensics : null} river={ok(s.river) ? s.river : null} />
        ) : gone(s.holders) ? (
          <Unavailable text={s.holders.unavailable} />
        ) : pending(s.holders) ? (
          <WaveLoading what="holders" height={420} />
        ) : null}
      </Card>
    ),
    cohorts: (cls) => (
      <Card
        id="cohorts"
        className={cls}
        title={ok(s.wind) ? windTitle(s.wind) : 'Who is buying'}
        sub="Net flow by Nansen wallet segment; pick a window."
        action={ok(s.wind) ? <InfoPopover p={s.wind.provenance} /> : undefined}
      >
        {ok(s.wind) ? (
          <CohortBars w={s.wind} />
        ) : gone(s.wind) ? (
          <Unavailable text={s.wind.unavailable} />
        ) : pending(s.wind) ? (
          <WaveLoading what="flow intelligence" height={240} />
        ) : null}
      </Card>
    ),
    odds: (cls) => (
      <Card
        id="odds"
        className={cls}
        title={ok(s.forecast) ? oddsTitle(s.forecast) : '7-day odds'}
        sub="Calibrated probabilities of a 50% drop or a 30% rise within a week, each with its out-of-sample track record."
      >
        {ok(s.forecast) ? (
          <OddsCard f={s.forecast} />
        ) : gone(s.forecast) ? (
          <Unavailable text={s.forecast.unavailable} />
        ) : pending(s.forecast) ? (
          <WaveLoading what="the projection inputs" height={260} />
        ) : null}
      </Card>
    ),
    wind: (cls) => (
      <Card
        id="wind"
        className={cls}
        title={ok(s.wind) ? windTitle(s.wind) : 'Cohort flows'}
        sub="Who is moving this token: net flow by wallet segment, one ring per window."
      >
        {ok(s.wind) ? (
          <WindRose w={s.wind} />
        ) : gone(s.wind) ? (
          <Unavailable text={s.wind.unavailable} />
        ) : pending(s.wind) ? (
          <WaveLoading what="flow intelligence" height={360} />
        ) : null}
      </Card>
    ),
    traders: (cls) => (
      <Card
        id="traders"
        className={cls}
        title={ok(s.holders) && !s.holders.tradersUnavailable ? tradersTitle(s.holders) : 'Top buyers vs sellers'}
        sub="The ten largest buyers and sellers over 7 days, one shared USD scale. Select a wallet for its page."
      >
        {ok(s.holders) ? (
          s.holders.tradersUnavailable ? (
            <Unavailable text={s.holders.tradersUnavailable} />
          ) : (
            <BuyersSellers h={s.holders} clustered={clustered} />
          )
        ) : gone(s.holders) ? (
          <Unavailable text={s.holders.unavailable} />
        ) : pending(s.holders) ? (
          <WaveLoading what="buyers and sellers" height={360} />
        ) : null}
      </Card>
    ),
    holders: (cls) => (
      <Card
        id="holders"
        className={cls}
        title={ok(s.holders) ? holdersTitle(s.holders) : 'Holders'}
        sub="Lorenz curve of the top 100 non-custodial holders (the further below the diagonal, the more concentrated), and all top 100 grouped by Nansen label."
      >
        {ok(s.holders) ? (
          <HolderPanel h={s.holders} />
        ) : gone(s.holders) ? (
          <Unavailable text={s.holders.unavailable} />
        ) : pending(s.holders) ? (
          <WaveLoading what="holders" height={420} />
        ) : null}
      </Card>
    ),
    insiders: (cls) => (
      <Card
        id="insiders"
        className={cls}
        title={ok(s.forensics) ? forensicsTitle(s.forensics) : 'Insider clusters'}
        sub="Top 25 holders linked by a shared first funder (cross-chain) or Nansen related-wallets, and to the deployer."
      >
        {ok(s.forensics) ? (
          <InsiderGraph f={s.forensics} />
        ) : gone(s.forensics) ? (
          <Unavailable text={s.forensics.unavailable} />
        ) : pending(s.forensics) ? (
          <WaveLoading what="first funders and related wallets for the top 25 holders" height={360} />
        ) : null}
      </Card>
    ),
    leverage: (cls) => (
      <Card
        id="leverage"
        className={cls}
        title={ok(s.leverage) ? leverageTitle(s.leverage) : 'Liquidation ladder'}
        sub="Where the 100 largest Hyperliquid positions in this symbol are forced out, by distance from the mark."
        action={ok(s.leverage) ? <InfoPopover p={s.leverage.provenance} /> : undefined}
      >
        {ok(s.leverage) ? (
          <LiquidationLadder w={s.leverage} />
        ) : gone(s.leverage) ? (
          <Unavailable text={s.leverage.unavailable} />
        ) : pending(s.leverage) ? (
          <WaveLoading what="perp positions" height={320} />
        ) : null}
      </Card>
    ),
    tape: (cls) => (
      <Card
        id="tape"
        className={cls}
        title={ok(s.tape) ? tapeTitle(s.tape) : 'Live DEX trades'}
        sub="The latest trades of this token across its DEX pools, newest first. Select a row for the whole transaction."
        action={ok(s.tape) ? <InfoPopover p={s.tape.provenance} /> : undefined}
      >
        {ok(s.tape) ? (
          <LiveTape t={s.tape} chain={chain} />
        ) : gone(s.tape) ? (
          <Unavailable text={s.tape.unavailable} />
        ) : pending(s.tape) ? (
          <WaveLoading what="DEX trades" height={320} />
        ) : null}
      </Card>
    ),
    river: (cls) => (
      <Card
        id="river"
        className={cls}
        title={ok(s.river) ? riverTitle(s.river) : 'Whale transfers'}
        sub={
          ok(s.river) && s.river.byCohort
            ? 'The day’s largest transfers outside DEX trades, and the ones far larger than their sender’s cohort usually moves.'
            : 'The day’s largest transfers outside DEX trades, and the ones far larger than this token’s usual transfer.'
        }
        action={ok(s.river) ? <InfoPopover p={s.river.provenance} /> : undefined}
      >
        {ok(s.river) ? (
          <TransferRiver r={s.river} chain={chain} />
        ) : gone(s.river) ? (
          <Unavailable text={s.river.unavailable} />
        ) : pending(s.river) ? (
          <WaveLoading what="transfers" height={320} />
        ) : null}
      </Card>
    ),
    social: (cls) => (
      <Card
        id="social"
        className={cls}
        title={ok(s.social) ? socialTitle(s.social) : 'Social pulse'}
        sub="Posts mentioning the symbol over 7 days, and how fast the conversation is growing."
        action={ok(s.social) ? <InfoPopover p={s.social.provenance} /> : undefined}
      >
        {ok(s.social) ? (
          <SocialPulse s={s.social} />
        ) : gone(s.social) ? (
          <Unavailable text={s.social.unavailable} />
        ) : pending(s.social) ? (
          <WaveLoading what="social posts" height={280} />
        ) : null}
      </Card>
    ),
    dca: (cls) => (
      <Card
        id="dca"
        className={cls}
        title={ok(s.dca) ? dcaTitle(s.dca) : 'DCA ladders'}
        sub="Open Jupiter DCA orders that will keep buying or selling this token, largest remaining first."
        action={ok(s.dca) ? <InfoPopover p={s.dca.provenance} /> : undefined}
      >
        {ok(s.dca) ? (
          <DcaLadder d={s.dca} />
        ) : gone(s.dca) ? (
          <Unavailable text={s.dca.unavailable} />
        ) : pending(s.dca) ? (
          <WaveLoading what="DCA orders" height={260} />
        ) : null}
      </Card>
    ),
    positions: (cls) => (
      <Card
        id="positions"
        className={cls}
        title={ok(s.positions) ? positionsTitle(s.positions) : 'Perp flow gauge'}
        sub="Hyperliquid positions in this symbol by cohort: the waterline is the share that is long."
        action={ok(s.positions) ? <InfoPopover p={s.positions.provenance} /> : undefined}
      >
        {mode === 'public' ? (
          <Unavailable text={WITHHELD} />
        ) : ok(s.positions) ? (
          <TideGauge p={s.positions} />
        ) : gone(s.positions) ? (
          <Unavailable text={s.positions.unavailable} />
        ) : pending(s.positions) ? (
          <WaveLoading what="perp positions" height={220} />
        ) : null}
      </Card>
    ),
    pnlboard: (cls) => (
      <Card
        id="pnlboard"
        className={cls}
        title="Top traders by PnL, 30 days"
        sub="Who made and lost the most on this token (realized plus unrealized)."
        action={ok(s.pnlboard) ? <InfoPopover p={s.pnlboard.provenance} /> : undefined}
      >
        {mode === 'public' ? (
          <Unavailable
            text={
              'Shown to the API key owner or a signed-in member with their own key: Nansen does not allow its PnL leaderboard in public views.'
            }
          />
        ) : ok(s.pnlboard) ? (
          <PnlBoard b={s.pnlboard} />
        ) : gone(s.pnlboard) ? (
          <Unavailable text={s.pnlboard.unavailable} />
        ) : pending(s.pnlboard) ? (
          <WaveLoading what="the PnL leaderboard" height={260} />
        ) : null}
      </Card>
    ),
    news: (cls) => (
      <Card
        id="news"
        className={cls}
        title={`News about ${symbol ?? 'this token'}`}
        sub="Web results from Nansen’s hosted search, on request."
      >
        {h ? (
          <NewsCards name={h.name} symbol={h.symbol} canSummarize={mode !== 'public'} />
        ) : (
          <WaveLoading what="the token name" height={80} />
        )}
      </Card>
    ),
    // The design's chat card for everyone; the owner's alert tools sit below it.
    ask: (cls) => (
      <div className={`flex min-w-0 flex-col gap-4 ${cls}`}>
        <TokenAskChat chain={chain} address={address} symbol={symbol} band={ok(s.storm) ? STORM_LABEL[s.storm.result.band] : null} />
        {accounts && mode !== 'public' && ok(s.storm) && s.storm.final && (
          <Card
            id="alerts-tools"
            title={`Watch ${symbol ?? 'this token'} after you leave`}
            sub="A risk alert turns these scores into Nansen Smart Alerts on your account."
          >
            <StormAlertForm chain={chain} address={address} clusterWallets={[...clustered]} />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[12.5px]">
              <span className="text-ink-muted">More alerts:</span>
              <Link
                href={`/alerts?template=token-flows&chain=${chain}&token=${encodeURIComponent(address)}`}
                className="text-ink-2 underline-offset-2 hover:text-ink hover:underline"
              >
                smart money buying {symbol ?? 'this token'} <Go />
              </Link>
              {ok(s.forensics) && s.forensics.deployer && /^0x[0-9a-fA-F]{40}$/.test(s.forensics.deployer) && (
                <Link
                  href={`/alerts?template=deployer&chain=${chain}&address=${s.forensics.deployer}`}
                  className="text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                >
                  the deployer moves again <Go />
                </Link>
              )}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <RideCard chain={chain} address={address} symbol={symbol} />
            </div>
          </Card>
        )}
      </div>
    ),
  };

  return (
    <div className="space-y-4">
      <TokenActions chain={chain} address={address} symbol={symbol} owner={mode === 'owner'} />
      <TokenHero
        chain={chain}
        address={address}
        tier={tier}
        title={title}
        h={h}
        m={ok(s.market) ? s.market : null}
        storm={ok(s.storm) ? s.storm : null}
        done={s.done}
        events={smEvents}
      >
        {cards.storm('')}
      </TokenHero>
      <VerdictCard chain={chain} address={address} ready={ok(s.storm)} />
      {quickRead}
      {s.fatal && <p className="rounded-md border border-border px-3 py-2 text-sm text-ink-2">{s.fatal}</p>}
      {gone(s.header) && <Unavailable text={s.header.unavailable} />}
      {h?.isStablecoin && (
        <p className="text-[12px] text-ink-2">Nansen classifies this token as a stablecoin; dump-risk scoring is not meaningful for it.</p>
      )}

      <div className="sticky top-14 z-20 -mx-1 overflow-x-auto px-1 py-1 lg:top-2">
        <div
          role="tablist"
          aria-label="Token views"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-[var(--hair)] bg-ink/5 p-1"
        >
          {VIEWS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${view === k ? 'bg-ink/12 text-ink shadow-[inset_0_1px_0_var(--hair-2),0_3px_8px_#0003]' : 'text-ink-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-label={VIEWS.find(([k]) => k === view)![1]} className="space-y-4">
        {LAYOUT[view].map((row, i) => {
          // Token Score lives in the hero on every view; rendering it again here
          // would duplicate its section and its #storm anchor.
          const items = row.items
            .filter(([key]) => key !== 'storm')
            .map(([key, span]) => [key, cards[key](span ? SPAN[span] : '')] as const)
            .filter(([, el]) => el);
          if (!items.length) return null;
          return (
            <div key={`${view}-${i}`} className={`grid gap-4 ${row.cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
              {items.map(([key, el]) => (
                <div key={key} className={`contents`}>
                  {el}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {extra}
    </div>
  );
}

function sphereTitle(n: number, clustered: number, forensicsIn: boolean): string {
  const top = Math.min(n, 90);
  if (!forensicsIn) return `The top ${top} holders, sized by share of supply`;
  if (!clustered) return `The top ${top} holders: no insider clusters among the top 25`;
  return `${clustered} of the top 25 holders sit in insider clusters`;
}
