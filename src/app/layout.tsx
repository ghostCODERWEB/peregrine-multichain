import type { Metadata } from 'next';
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
import { NANSEN_REF_URL } from '@/config/referral';
import { TableSort } from '@/components/TableSort';
import { GetNansen } from '@/components/shell/GetNansen';
import { AnalyzeDock } from '@/components/analyze/AnalyzeDock';

const geistSans = Manrope({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = IBM_Plex_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Peregrine · smart-money intelligence for every chain',
  description:
    'Smart-money intelligence built on the Nansen API: a flow index for every chain, capital rotations between chains, dump-risk alerts on tokens, and projections with published accuracy.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}${publicSite() ? ' public-site' : ''}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers publicSite={publicSite()} accounts={accountsEnabled()}>
          <TableSort />
          <AnalyzeDock />
          <MotionObserver />
          <SiteHeader />
          <TabBar />
          <div className="pb-24 pt-16 lg:pb-0 lg:pl-[256px] lg:pt-0">
            <main className="mx-auto max-w-[1600px] px-4 3xl:max-w-[2000px] 3xl:px-8 pb-16 pt-5 lg:px-[14px] lg:pt-3"><div className="mb-2 flex items-center gap-4"><Suspense><WorkspaceBar /></Suspense><Suspense><MarketStrip /></Suspense><GetNansen className="ml-auto" /></div>{children}</main>
            <footer className="mx-auto max-w-[1600px] px-4 3xl:max-w-[2000px] 3xl:px-8 pb-8 text-xs text-ink-muted lg:px-7">
              <a href={NANSEN_REF_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">Data from Nansen</a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
