'use client';
import { useQuery } from '@tanstack/react-query';
import { CapitalFlows } from './CapitalFlows';
import type { ChainTile, FrontWithProvenance } from '@/server/weather/bulletin';
type FlowSnapshot = { fronts: FrontWithProvenance[]; chains: Pick<ChainTile,'chain'|'cpi'>[]; withheld: string[] };
/** Refresh uses the same server-redacted bulletin as Radar. Client flags never grant access. */
export function FlowsView({ initial }: { initial: FlowSnapshot }) {
 const { data } = useQuery({queryKey:['weather'],initialData:initial,queryFn:async ():Promise<FlowSnapshot>=>{const r=await fetch('/api/weather',{cache:'no-store'});if(!r.ok)throw new Error('Flow refresh unavailable');return r.json();},refetchInterval:60_000});
 return <CapitalFlows initial={data.fronts} chains={data.chains} withheld={data.withheld.includes('fronts')}/>;
}
