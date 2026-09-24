import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { themeBootScript } from '@/components/ThemeToggle';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

// Visual-only pointer parallax belongs in the document shell, not a hydrated
// React component. This keeps the effect out of every route's JS bundle.
const liquidMotionScript = `(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return;
  let f = 0;
  addEventListener('pointermove', (e) => {
    cancelAnimationFrame(f);
    f = requestAnimationFrame(() => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5, s = document.documentElement.style;
      s.setProperty('--liquid-x', (x * 22).toFixed(1) + 'px');
      s.setProperty('--liquid-y', (y * 18).toFixed(1) + 'px');
      s.setProperty('--liquid-x-reverse', (x * -14).toFixed(1) + 'px');
      s.setProperty('--liquid-y-reverse', (y * -12).toFixed(1) + 'px');
    });
  }, { passive: true });
})();`;

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
        <script dangerouslySetInnerHTML={{ __html: liquidMotionScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <div className="liquid-backdrop" aria-hidden="true">
          <span className="liquid-orb liquid-orb-a" />
          <span className="liquid-orb liquid-orb-b" />
          <span className="liquid-mesh" />
        </div>
        <Providers>
          <SiteHeader />
          <div className="pt-14 lg:pl-[248px] lg:pt-0">
            <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 lg:px-6">{children}</main>
            <footer className="mx-auto max-w-[1400px] px-4 pb-8 text-xs text-ink-muted lg:px-6">
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
