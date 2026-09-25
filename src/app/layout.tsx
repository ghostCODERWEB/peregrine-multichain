import type { Metadata } from 'next';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { themeBootScript } from '@/components/ThemeToggle';
import { TabBar } from '@/components/shell/TabBar';
import { publicSite } from '@/server/site';

const geistSans = Manrope({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = IBM_Plex_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Peregrine — smart-money intelligence for every chain',
  description:
    'Smart-money intelligence built on the Nansen API: a flow index for every chain, capital rotations between chains, dump-risk alerts on tokens, and projections with published accuracy.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}${publicSite() ? ' public-site' : ''}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers publicSite={publicSite()}>
          <SiteHeader />
          <TabBar />
          <div className="pb-24 pt-16 lg:pb-0 lg:pl-[256px] lg:pt-0">
            <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-5 lg:px-[14px] lg:pt-6">{children}</main>
            <footer className="mx-auto max-w-[1480px] px-4 pb-8 text-xs text-ink-muted lg:px-7">
              <a href="https://www.nansen.ai" target="_blank" rel="noopener noreferrer" className="font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">Powered by Nansen API</a>.{' '}
              Every number on this site is computed from Nansen API responses — tap any ⓘ for the formula, its inputs and
              the exact call. Probabilistic readings, not financial advice.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
