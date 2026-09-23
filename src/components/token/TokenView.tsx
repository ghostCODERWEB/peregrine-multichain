'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { AnchorCard } from '@/components/AnchorCard';
import { StormAlertForm } from './StormAlertForm';
import { RideCard } from './RideCard';
import { chainName, shortAddress, usd } from '@/lib/viz/format';
import type { Wave, TokenHeader, MarketWave, WindWave, HoldersWave, ForensicsWave } from '@/server/token/waves';
import type { StormWave } from '@/server/token/storm';

interface State {
  header?: Wave<TokenHeader>;
  market?: Wave<MarketWave>;
  wind?: Wave<WindWave>;
  holders?: Wave<HoldersWave>;
  forensics?: Wave<ForensicsWave>;
  storm?: Wave<StormWave>;
  forecast?: Wave<ForecastWave>;
  done?: { calls: number; credits: number; cached: number };
  fatal?: string;
}

const WAVES = ['header', 'market', 'forecast', 'wind', 'holders', 'forensics', 'storm', 'done', 'fatal'] as const;
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

export function TokenView({ chain, address, tier }: { chain: string; address: string; tier: string }) {
  const s = useTokenStream(chain, address);
  const h = ok(s.header) ? s.header : null;
  const symbol = h?.symbol ?? null;
  const clustered = useMemo(
    () => new Set(ok(s.forensics) ? s.forensics.clusters.filter((c) => c.wallets.length >= 2).flatMap((c) => c.wallets.map((w) => w.toLowerCase())) : []),
    [s.forensics],
  );
  const pending = (w: unknown) => w === undefined && !s.fatal;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/chain/${chain}`} className="text-[12.5px] text-ink-2 hover:text-ink">← {chainName(chain)}</Link>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          {ok(s.storm) ? stormTitle(symbol, s.storm) : h ? `${h.name ?? h.symbol} on ${chainName(chain)}` : gone(s.header) ? `Token on ${chainName(chain)}` : 'Reading the token from Nansen…'}
        </h1>
        <p className="mt-1 break-all text-sm text-ink-2">
          {h?.name && h.symbol ? `${h.name} (${h.symbol}) · ` : ''}{chainName(chain)} · tier {tier} · <span className="num">{shortAddress(address)}</span>
          {s.done && <span className="num"> · this page: {s.done.calls} Nansen calls, {s.done.credits} credits ({s.done.cached} from cache)</span>}
        </p>
        {s.fatal && <p className="mt-2 rounded-md border border-border px-3 py-2 text-sm text-ink-2">{s.fatal}</p>}
        {gone(s.header) && <div className="mt-3"><Unavailable text={s.header.unavailable} /></div>}
        {h && (
          <div className="mt-3 flex flex-wrap items-stretch gap-2">
            {[
              ['Market cap', usd(h.marketCapUsd)],
              ['Liquidity', usd(h.liquidityUsd)],
              ['24h volume', usd(h.volume24hUsd)],
              ['24h buyers / sellers', h.uniqueBuyers != null ? `${h.uniqueBuyers} / ${h.uniqueSellers}` : '—'],
              ['Holders', h.holders?.toLocaleString('en-US') ?? '—'],
              ['Deployed', h.deployedAt ? h.deployedAt.slice(0, 10) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-border bg-surface px-3 py-1.5">
                <div className="text-[10.5px] text-ink-muted">{k}</div>
                <div className="num text-[13.5px] text-ink">{v}</div>
              </div>
            ))}
            <div className="flex items-center"><InfoPopover p={h.provenance} /></div>
            {h.isStablecoin && <p className="w-full text-[12px] text-ink-2">Nansen classifies this token as a stablecoin; dump-risk scoring is not meaningful for it.</p>}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="storm" title={ok(s.storm) ? `Storm Score: ${Math.round(s.storm.result.score)} of 100` : 'Storm Score'} sub="Probability-style dump-risk score from six Nansen-derived inputs. Not financial advice.">
          {ok(s.storm) ? <StormDial s={s.storm} indicators={[...(h?.risk ?? []), ...(h?.reward ?? [])]} /> : gone(s.storm) ? <Unavailable text={s.storm.unavailable} /> : pending(s.storm) ? <WaveLoading what="the Storm Score inputs" height={420} /> : null}
        </Card>
        <Card
          id="market" className="lg:col-span-2"
          title={ok(s.market) ? marketTitle(symbol, s.market) : 'Price and flow'}
          sub="4-hour candles over 14 days with an 80% volatility cone 7 days ahead; below, the labelled holder segment's daily net flow."
        >
          {ok(s.market) ? <CandleChart m={s.market} /> : gone(s.market) ? <Unavailable text={s.market.unavailable} /> : pending(s.market) ? <WaveLoading what="candles" height={360} /> : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="odds" title={ok(s.forecast) ? oddsTitle(s.forecast) : '7-day odds'} sub="Calibrated probabilities of a 50% drop or a 30% rise within a week, each with its out-of-sample track record.">
          {ok(s.forecast) ? <OddsCard f={s.forecast} /> : gone(s.forecast) ? <Unavailable text={s.forecast.unavailable} /> : pending(s.forecast) ? <WaveLoading what="the forecast inputs" height={260} /> : null}
        </Card>
        <Card id="wind" title={ok(s.wind) ? windTitle(s.wind) : 'Wind rose'} sub="Who is moving this token: net flow by wallet segment, one ring per window.">
          {ok(s.wind) ? <WindRose w={s.wind} /> : gone(s.wind) ? <Unavailable text={s.wind.unavailable} /> : pending(s.wind) ? <WaveLoading what="flow intelligence" height={360} /> : null}
        </Card>
        <Card id="traders" title={ok(s.holders) && !s.holders.tradersUnavailable ? tradersTitle(s.holders) : 'Top buyers vs sellers'} sub="The ten largest buyers and sellers over 7 days, one shared USD scale. Select a wallet for its page.">
          {ok(s.holders) ? (s.holders.tradersUnavailable ? <Unavailable text={s.holders.tradersUnavailable} /> : <BuyersSellers h={s.holders} clustered={clustered} />)
            : gone(s.holders) ? <Unavailable text={s.holders.unavailable} /> : pending(s.holders) ? <WaveLoading what="buyers and sellers" height={360} /> : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="holders" title={ok(s.holders) ? holdersTitle(s.holders) : 'Holders'} sub="Lorenz curve of the top 100 non-custodial holders (the further below the diagonal, the more concentrated), and all top 100 grouped by Nansen label.">
          {ok(s.holders) ? <HolderPanel h={s.holders} /> : gone(s.holders) ? <Unavailable text={s.holders.unavailable} /> : pending(s.holders) ? <WaveLoading what="holders" height={420} /> : null}
        </Card>
        <Card id="insiders" title={ok(s.forensics) ? forensicsTitle(s.forensics) : 'Insider clusters'} sub="Top 25 holders linked by a shared first funder (cross-chain) or Nansen related-wallets, and to the deployer.">
          {ok(s.forensics) ? <InsiderGraph f={s.forensics} /> : gone(s.forensics) ? <Unavailable text={s.forensics.unavailable} /> : pending(s.forensics) ? <WaveLoading what="first funders and related wallets for the top 25 holders" height={360} /> : null}
        </Card>
      </div>
      {ok(s.storm) && s.storm.final && (
        <Card id="ask" title={`Ask the anchor about ${symbol ?? 'this token'}, or set a storm alert`} sub="Nansen's agent explains this token's scores in four sentences; a storm alert turns them into Nansen Smart Alerts that keep watching after you leave.">
          <AnchorCard query={`kind=token&chain=${chain}&address=${encodeURIComponent(address)}`} label="It reads the scores above; nothing is sent until you ask." />
          <div className="mt-4 border-t border-border pt-3">
            <StormAlertForm chain={chain} address={address} clusterWallets={[...clustered]} />
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <RideCard chain={chain} address={address} symbol={symbol} />
          </div>
        </Card>
      )}
    </div>
  );
}
