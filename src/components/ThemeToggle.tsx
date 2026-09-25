'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'tide-theme';

/** Inline in <head> so the stored theme applies before first paint. Dark
 *  navy is the default; "paper" is the light chart theme. */
export const themeBootScript = `(() => { try {
  const t = localStorage.getItem('${KEY}');
  document.documentElement.classList.toggle('dark', t !== 'paper');
} catch { document.documentElement.classList.add('dark'); } })();`;

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem(KEY, next ? 'navy' : 'paper'); } catch { /* storage unavailable: theme still applies for this view */ }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="liquid-control inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-2 hover:text-ink"
      aria-label={dark ? 'Switch to paper chart theme' : 'Switch to navy theme'}
      title={dark ? 'Paper chart theme' : 'Navy theme'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
