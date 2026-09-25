'use client';
import { createContext, useContext } from 'react';
import { publicReason } from '@/lib/site-text';

/** Instance facts the browser needs; set once by the root layout. */
const SiteCtx = createContext({ publicSite: false });

export function SiteProvider({ publicSite, children }: { publicSite: boolean; children: React.ReactNode }) {
  return <SiteCtx.Provider value={{ publicSite }}>{children}</SiteCtx.Provider>;
}

export const useSite = () => useContext(SiteCtx);

/** A withheld-data reason, without the sign-in route on a public site. */
export function SiteReason({ text }: { text: string }) {
  const { publicSite } = useSite();
  return <>{publicSite ? publicReason(text) : text}</>;
}
