import { redirect } from 'next/navigation';

/** The watchlist is a section of the Profiler page. */
export default function WatchlistPage() {
  redirect('/wallet#watchlist');
}
