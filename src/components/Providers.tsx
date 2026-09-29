'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { SiteProvider } from '@/components/SiteContext';

export function Providers({ children, publicSite = false, accounts = true }: { children: React.ReactNode; publicSite?: boolean; accounts?: boolean }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Refetch keeps the frame: hold the previous render while new data loads.
        placeholderData: (prev: unknown) => prev,
      },
    },
  }));
  return (
    <QueryClientProvider client={client}>
      <SiteProvider publicSite={publicSite} accounts={accounts}>{children}</SiteProvider>
    </QueryClientProvider>
  );
}
