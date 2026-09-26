import { redirect } from 'next/navigation';

/** The Backtest Lab's results now live on the Proof page. */
export default function LabPage() {
  redirect('/proof');
}
