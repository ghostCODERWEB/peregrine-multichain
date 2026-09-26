'use client';
import { createContext, useContext } from 'react';
import { publicReason } from '@/lib/site-text';

/** Instance facts the browser needs; set once by the root layout. */
const SiteCtx = createContext({ publicSite: false, accounts: true });

export function SiteProvider({ publicSite, accounts = true, children }: { publicSite: boolean; accounts?: boolean; children: React.ReactNode }) {
  return <SiteCtx.Provider value={{ publicSite, accounts }}>{children}</SiteCtx.Provider>;
}

export const useSite = () => useContext(SiteCtx);

/** A withheld-data reason, without the sign-in route on a public site. */
export function SiteReason({ text }: { text: string }) {
  const { publicSite } = useSite();
  return <>{publicSite ? publicReason(text) : text}</>;
}
