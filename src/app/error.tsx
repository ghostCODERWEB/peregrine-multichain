'use client';
import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { reloadForStaleBuild } from '@/lib/stale-build';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    console.error(error);
    reloadForStaleBuild(error);
  }, [error]);
  // Retry asks the server for the page again and drops cached answers, so it re-renders from fresh data rather
  // than the data that just failed; a second failure offers a full reload.
  const retry = () => {
    setTries((t) => t + 1);
    qc.clear();
    startTransition(() => { router.refresh(); reset(); });
  };
  return (
    <div className="material mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="t-section text-ink">This page hit a problem</h1>
      <p className="mt-2 text-[13px] text-ink-2">{tries ? 'It failed again. A full reload fetches everything fresh.' : 'Something in the page failed to load. Retrying fetches it fresh.'}</p>
      <div className="mt-4 flex justify-center gap-2">
        {tries ? (
          <button type="button" onClick={() => location.reload()} className="get-nansen inline-flex h-10 items-center rounded-full px-5 text-[13px] font-extrabold">Reload page</button>
        ) : (
          <button type="button" onClick={retry} className="get-nansen inline-flex h-10 items-center rounded-full px-5 text-[13px] font-extrabold">Retry</button>
        )}
        <Link prefetch={false} href="/" className="inline-flex h-10 items-center rounded-full border border-[var(--hair)] px-5 text-[13px] font-semibold text-ink-2 hover:text-ink">Overview</Link>
      </div>
    </div>
  );
}
