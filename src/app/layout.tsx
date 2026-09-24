import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { themeBootScript } from '@/components/ThemeToggle';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Peregrine — smart-money intelligence for every chain',
  description:
    'Smart-money intelligence built on the Nansen API: a flow index for every chain, capital rotations between chains, dump-risk alerts on tokens, and projections with published accuracy.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          <SiteHeader />
          <div className="pt-12">
            <main className="mx-auto max-w-[1600px] px-3 pb-16 pt-4 lg:px-5">{children}</main>
            <footer className="mx-auto max-w-[1600px] border-t border-border px-3 py-4 text-[11.5px] text-ink-muted lg:px-5">
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
