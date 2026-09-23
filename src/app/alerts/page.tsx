import type { Metadata } from 'next';
import { AlertsList } from '@/components/AlertsList';

export const metadata: Metadata = { title: 'Storm alerts — TIDE' };

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Storm alerts, running on Nansen</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Nansen Smart Alerts TIDE created from token Storm Scores. They keep watching with this tab closed and deliver to your Telegram or Discord.
          Only alerts TIDE created are listed here; your other Nansen alerts are untouched.
        </p>
      </div>
      <section className="rounded-xl border border-border bg-surface p-4"><AlertsList /></section>
    </div>
  );
}
