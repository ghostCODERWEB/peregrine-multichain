import { buildBulletin } from '@/server/weather/bulletin';
import { WeatherView } from '@/components/weather/WeatherView';
import { latestReport } from '@/server/agents/anchor';

export const dynamic = 'force-dynamic';

export default function Home() {
  // Rendered from TIDE's own scanner history: no Nansen call per page view.
  const bulletin = buildBulletin();
  return <WeatherView initial={bulletin} anchor={latestReport('bulletin')} />;
}
