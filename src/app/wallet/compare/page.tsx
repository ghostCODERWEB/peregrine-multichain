import { redirect } from 'next/navigation';

/** Trader comparison is a section of the Profiler page; addresses carry over. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const qs = ['a', 'b', 'c', 'd'].filter((k) => q[k]).map((k) => `${k}=${encodeURIComponent(q[k]!)}`).join('&');
  redirect(`/wallet${qs ? `?${qs}` : ''}#compare`);
}
