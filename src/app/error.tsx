'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { reloadForStaleBuild } from '@/lib/stale-build';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reloadForStaleBuild(error);
  }, [error]);
  return (
    <div className="material mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="t-section text-ink">This page hit a problem</h1>
      <p className="mt-2 text-[13px] text-ink-2">Something in the page failed to load. Retrying usually fixes it.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={() => reset()} className="get-nansen inline-flex h-10 items-center rounded-full px-5 text-[13px] font-extrabold">Retry</button>
        <Link prefetch={false} href="/" className="inline-flex h-10 items-center rounded-full border border-[var(--hair)] px-5 text-[13px] font-semibold text-ink-2 hover:text-ink">Overview</Link>
      </div>
    </div>
  );
}
