'use client';
import Link from 'next/link';
import { shortAddress } from '@/lib/viz/format';

/** Header entry point: "Sign in" or the signed-in address, both to /account. */
export function AccountButton({ signedIn, address }: { signedIn: boolean; address: string | null }) {
  return (
    <Link href="/account" className="whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-[12px] text-ink-2 hover:bg-accent hover:text-ink">
      {signedIn && address ? <span className="num">{shortAddress(address)}</span> : 'Sign in'}
    </Link>
  );
}
