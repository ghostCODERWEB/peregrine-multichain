import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Ask Nansen on Peregrine: Ask about any token, wallet or chain';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Ask Nansen', title: 'Ask about any token, wallet or chain', subtitle: 'Answers from the Nansen research agent, grounded in the data on the screen.', chips: ['Tokens', 'Wallets', 'Chains', 'Nansen research agent'] });
}
