import { buildBulletin } from '@/server/weather/bulletin';
import { WeatherView } from '@/components/weather/WeatherView';
import { latestReport, subjectKey } from '@/server/agents/anchor';
import { displayMode, viewOf } from '@/server/mode';
import { alphaBoard } from '@/server/alpha/board';
import { AlphaStrip } from '@/components/alpha/AlphaStrip';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Rendered from TIDE's own scanner history: no Nansen call per page view.
  const mode = await displayMode();
  const bulletin = buildBulletin(viewOf(mode));
  const alpha = alphaBoard(viewOf(mode), Date.now(), 5);
  return <WeatherView initial={bulletin} anchor={latestReport(subjectKey('bulletin', mode))} alpha={<AlphaStrip rows={alpha.rows} />} />;
}
