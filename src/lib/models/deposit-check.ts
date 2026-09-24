// Checks a Hyperliquid deposit quote (perp/bridge/quote, a Relay route) before
// any transaction reaches the user's wallet. Nansen's guide warns that a wrong
// amount scale is quoted without an error, so the amount, its decimals, the
// destination balance, the sender, the chain and the approval are all checked
// against what the user asked for. Any mismatch refuses the quote.
import { z } from 'zod';

const Amount = z.object({ amount: z.string(), amount_formatted: z.string(), decimals: z.number(), name: z.string() });
const Tx = z.object({ from: z.string(), to: z.string(), data: z.string(), value: z.string(), chainId: z.number(), gas: z.string().optional() });
export const S_DepositQuote = z.looseObject({
  execution_type: z.string(),
  request_id: z.string(),
  amount_in: Amount, amount_out: Amount,
  steps: z.array(z.looseObject({ id: z.string(), kind: z.string(), description: z.string().optional(), items: z.array(z.looseObject({ data: Tx })) })).min(1).max(3),
  fees: z.looseObject({ relayer: z.looseObject({ amountFormatted: z.string().optional(), amountUsd: z.string().optional() }).optional() }).optional(),
  details: z.looseObject({ timeEstimate: z.number().optional(), totalImpact: z.looseObject({ percent: z.string().optional() }).optional() }).optional(),
});

export interface DepositTx { step: string; description: string; tx: z.infer<typeof Tx> }
export interface DepositView { requestId: string; send: string; receive: string; receiveName: string; feeUsdc: string | null; impactPct: number | null; seconds: number | null; steps: Array<{ id: string; description: string }> }
export interface DepositExpect { wallet: string; chainId: number; usdc: string; amountBase: string; decimals: number }

const APPROVE = '0x095ea7b3';
const lc = (s: string) => s.toLowerCase();

export function checkDepositQuote(raw: unknown, want: DepositExpect): { view: DepositView; txs: DepositTx[] } | { error: string } {
  const p = S_DepositQuote.safeParse(raw);
  if (!p.success) return { error: 'Nansen’s deposit quote came back in an unexpected shape.' };
  const q = p.data;
  if (q.execution_type !== 'evm_transaction') return { error: `Expected a deposit you send from your wallet; Nansen returned “${q.execution_type}”.` };
  if (q.amount_in.amount !== want.amountBase || q.amount_in.decimals !== want.decimals) return { error: 'The quote’s amount or decimals don’t match what you entered; nothing was sent.' };
  if (!/perps/i.test(q.amount_out.name)) return { error: `This route lands in “${q.amount_out.name}”, not the perps balance; nothing was sent.` };
  const txs: DepositTx[] = q.steps.flatMap((s) => s.items.map((i) => ({ step: s.id, description: s.description ?? s.id, tx: i.data })));
  for (const { tx } of txs) {
    if (lc(tx.from) !== lc(want.wallet)) return { error: 'A step in the quote is from another wallet.' };
    if (tx.chainId !== want.chainId) return { error: 'A step in the quote targets another chain.' };
    if (tx.value !== '0') return { error: 'A step would also send the native coin; a USDC deposit shouldn’t.' };
  }
  const approvals = txs.filter((t) => t.tx.data.startsWith(APPROVE));
  const deposits = txs.filter((t) => !t.tx.data.startsWith(APPROVE));
  if (deposits.length !== 1) return { error: 'Expected exactly one deposit transaction.' };
  for (const { tx } of approvals) {
    if (lc(tx.to) !== lc(want.usdc)) return { error: 'The approval is not for USDC on this chain.' };
    const spender = `0x${tx.data.slice(10 + 24, 74)}`;
    const amount = BigInt(`0x${tx.data.slice(74, 138) || '0'}`);
    if (lc(spender) !== lc(deposits[0].tx.to)) return { error: 'The approval names a different contract than the deposit.' };
    if (amount !== BigInt(want.amountBase)) return { error: 'The approval is not for exactly the amount you entered.' };
  }
  const impact = Number(q.details?.totalImpact?.percent);
  return {
    txs,
    view: {
      requestId: q.request_id, send: q.amount_in.amount_formatted, receive: q.amount_out.amount_formatted, receiveName: q.amount_out.name,
      feeUsdc: q.fees?.relayer?.amountFormatted ?? null, impactPct: Number.isFinite(impact) ? impact : null, seconds: q.details?.timeEstimate ?? null,
      steps: q.steps.map((s) => ({ id: s.id, description: s.description ?? s.id })),
    },
  };
}
