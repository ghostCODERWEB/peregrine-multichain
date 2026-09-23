// Number formatting shared by every readout. Compact, signed where sign
// carries meaning, and never "NaN" or "Infinity" on screen.

export function usd(v: number | null | undefined, { signed = false } = {}): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  const a = Math.abs(v);
  const body = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B`
    : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M`
    : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K`
    : a.toFixed(a < 10 ? 2 : 0);
  return `${sign}$${body}`;
}

export function num(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function signed(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? s.replace('-', '−') : s;
}

export function ago(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** Nansen labels unlabeled wallets as "[0x…]" — that's an address stand-in,
 *  not a name, so it's dropped in favour of the address itself. */
export function walletName(label: string | null | undefined, address: string): string {
  if (label && !/^\[0x[0-9a-f]+\]$/i.test(label.trim())) return label.trim();
  return shortAddress(address);
}

const CHAIN_LABELS: Record<string, string> = {
  bnb: 'BNB Chain', hyperevm: 'HyperEVM', iotaevm: 'IOTA EVM', hyperliquid: 'Hyperliquid',
};

export function chainName(id: string): string {
  return CHAIN_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
