import { describe, it, expect } from 'vitest';
import { plainAnchorText } from './plain-text';

describe('plainAnchorText', () => {
  it('keeps link labels and drops invented URLs (live agent/fast output)', () => {
    const live = 'strongest around [JUP](https://app.nansen.ai/token-god-mode?tokenAddress=JUP&chain=solana) at 96 and [TAKE](https://app.nansen.ai/token-god-mode?tokenAddress=TAKE&chain=sui) at 93.';
    expect(plainAnchorText(live)).toBe('strongest around JUP at 96 and TAKE at 93.');
  });
  it('removes bare URLs, emphasis and headings without touching numbers', () => {
    expect(plainAnchorText('## Outlook\n**Base** CPI is 72 (see https://example.invalid/x) today.')).toBe('Outlook\nBase CPI is 72 today.');
    expect(plainAnchorText('Details at https://example.invalid/x.')).toBe('Details at.');
    expect(plainAnchorText('Net flow $7,821 across 3 wallets; odds 5*3.')).toBe('Net flow $7,821 across 3 wallets; odds 5*3.');
  });
  it('never flashes a half-streamed URL', () => {
    expect(plainAnchorText('around [JUP](https://app.nansen.ai/token-go')).toBe('around [JUP]');
  });
});
