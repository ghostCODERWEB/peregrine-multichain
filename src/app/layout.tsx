import type { Metadata, Viewport } from 'next';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { themeBootScript } from '@/components/ThemeToggle';
import { TabBar } from '@/components/shell/TabBar';
import { MotionObserver } from '@/components/MotionObserver';
import { WorkspaceBar } from '@/components/shell/WorkspaceBar';
import { MarketStrip } from '@/components/shell/MarketStrip';
import { Suspense } from 'react';
import { accountsEnabled, publicSite } from '@/server/site';
import { TableSort } from '@/components/TableSort';
import { Pager } from '@/components/Pager';
import { SectionRail } from '@/components/SectionRail';
import { MobileClamp } from '@/components/MobileClamp';
import { GuidedTour } from '@/components/GuidedTour';
import { AnalyzeLauncher } from '@/components/analyze/AnalyzeLauncher';
import { NavProgress } from '@/components/shell/NavProgress';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, pageMeta, siteUrl } from '@/server/seo';
import { OffscreenPause } from '@/components/OffscreenPause';
import { PublicAttribution } from '@/components/shell/PublicAttribution';

const geistSans = Manrope({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = IBM_Plex_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  // The public address, so share cards and canonical links resolve outside this machine (SITE_URL or the host's domain).
  metadataBase: new URL(siteUrl()),
  ...pageMeta({ title: `${SITE_NAME} · ${SITE_TAGLINE}`, description: SITE_DESCRIPTION, path: '/', absoluteTitle: true }),
  applicationName: SITE_NAME,
  keywords: ['smart money', 'onchain analytics', 'Nansen', 'crypto flows', 'chain flows', 'Flow Index', 'Hyperliquid perps', 'Polymarket', 'token risk', 'dump risk', 'wallet profiler', 'crypto sectors'],
  icons: { icon: '/icon.png', apple: '/brand/peregrine-256.png' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#040507' }, { media: '(prefers-color-scheme: light)', color: '#F5F6F8' }],
  colorScheme: 'dark light',
};

/** What search engines read about the site as a whole: the site and the web app. */
const structuredData = () => JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${siteUrl()}/#website`, url: siteUrl(), name: SITE_NAME, description: SITE_DESCRIPTION, inLanguage: 'en' },
    { '@type': 'WebApplication', name: SITE_NAME, url: siteUrl(), applicationCategory: 'FinanceApplication', operatingSystem: 'Web', description: SITE_DESCRIPTION, image: `${siteUrl()}/opengraph-image`, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
  ],
}).replace(/</g, '\\u003c');

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}${publicSite() ? ' public-site' : ''}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData() }} />
        {/* Token logos redirect to these hosts (/api/logo): open their connections before the first logo asks. */}
        <link rel="preconnect" href="https://cdn.dexscreener.com" />
        <link rel="preconnect" href="https://assets.coincap.io" />
        <link rel="dns-prefetch" href="https://coin-images.coingecko.com" />
        <link rel="dns-prefetch" href="https://financialmodelingprep.com" />
      </head>
      <body className="min-h-screen antialiased">
        <Providers publicSite={publicSite()} accounts={accountsEnabled()}>
          <TableSort />
          <Pager />
          <SectionRail />
          <MobileClamp />
          <GuidedTour />
          <AnalyzeLauncher />
          <Suspense><NavProgress /></Suspense>
          <MotionObserver />
          <OffscreenPause />
          <SiteHeader />
          <TabBar />
          <div className="pt-[68px] lg:pl-[256px] lg:pt-0">
            <main className="mx-auto max-w-[1600px] px-4 3xl:max-w-[2000px] 3xl:px-8 pb-[104px] pt-2 lg:pb-16 lg:px-[14px] lg:pt-3"><div className="mb-2 flex items-center gap-4 lg:min-h-8"><Suspense><WorkspaceBar /></Suspense><Suspense><MarketStrip /></Suspense></div>{children}<Suspense><PublicAttribution /></Suspense></main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
