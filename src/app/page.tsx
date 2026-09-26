import { buildBulletin } from '@/server/weather/bulletin';
import { WeatherView } from '@/components/weather/WeatherView';
import { latestReport, subjectKey } from '@/server/agents/anchor';
import { displayMode, viewOf } from '@/server/mode';
import { alphaBoard } from '@/server/alpha/board';
import { AlphaStrip } from '@/components/alpha/AlphaStrip';
import { OverviewIntel } from '@/components/weather/OverviewIntel';
import { RiskRadar } from '@/components/weather/RiskRadar';
import { MobileHome } from '@/components/mobile/MobileHome';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Rendered from TIDE's own scanner history: no Nansen call per page view.
  const mode = await displayMode();
  const bulletin = buildBulletin(viewOf(mode));
  const alpha = alphaBoard(viewOf(mode), Date.now(), 5);
  // Phones get their own Today screen; tablets and desktops the full overview.
  return (
    <>
      <div className="lg:hidden"><MobileHome mode={mode} chains={bulletin.chains} /></div>
      <div className="max-lg:hidden"><WeatherView initial={bulletin} anchor={latestReport(subjectKey('bulletin', mode))} alpha={<AlphaStrip rows={alpha.rows} />} intel={<><RiskRadar mode={mode} /><OverviewIntel mode={mode} /></>} /></div>
    </>
  );
}
