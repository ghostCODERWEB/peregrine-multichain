import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { themeBootScript } from '@/components/ThemeToggle';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TIDE — smart-money weather across every chain',
  description:
    'A live weather map of capital built on the Nansen API: chain pressure, rotation fronts between chains, storm warnings on tokens, and forecasts with published accuracy.',
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
          <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6">{children}</main>
          <footer className="mx-auto max-w-[1400px] px-4 pb-8 text-xs text-ink-muted">
            Every number on this site is computed from Nansen API responses — tap any ⓘ for the formula, its inputs and
            the exact call. Probabilistic readings, not financial advice.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
