import { validated } from './portfolio';
import { S_ProfilerAddressCounterpartiesBatchResponse } from '@/types/nansen/api.gen';
import { detectAddress } from '@/lib/address-family';
import { walletAddresses } from '@/lib/models/portfolio';
import { requestDay } from '@/server/nansen/demo';
import type { DeskData } from '@/server/wallet/desk';
import { chainName, usd } from '@/lib/viz/format';

export async function portfolioCounterparties(input: string[]): Promise<DeskData> {
  const addresses = walletAddresses(input);
  if (!addresses.length) throw new Error('Add at least one wallet.');
  const evm = addresses.filter((a) => /^0x[\da-f]{40}$/i.test(a));
  const solana = addresses.filter((a) => !evm.includes(a) && detectAddress(a)[0]?.family === 'solana');
  const unsupported = addresses.filter((a) => !evm.includes(a) && !solana.includes(a));
  const data: DeskData = { title: 'Counterparty connections · 30 days', description: 'Recent transfer counterparties, grouped by wallet. Shared counterparties are connections, not proof that wallets share an owner.', tables: [], provenance: { title: 'Batch counterparty coverage', formula: 'Nansen per-wallet counterparty rows; EVM and Solana requests are kept separate.', inputs: [{ label: 'Requested wallets', value: String(addresses.length) }], calls: [], notes: ['At most 100 rows per ecosystem. Pagination can omit later wallet blocks; missing rows do not establish inactivity.', ...(unsupported.length ? [`${unsupported.length} wallet(s) belong to ecosystems not supported by this batch view.`] : [])] } };
  for (const [chain, group] of [['all', evm], ['solana', solana]] as const) {
    if (!group.length) continue;
    try {
      const r = await validated('profiler/address/counterparties/batch', { wallet_addresses: group, chain, date: { from: requestDay(30), to: requestDay(0) }, pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'total_volume_usd', direction: 'DESC' }] }, S_ProfilerAddressCounterpartiesBatchResponse);
      data.provenance.calls.push(r.call);
      data.tables.push({ title: chain === 'all' ? 'EVM wallets' : 'Solana wallets', columns: ['Wallet', 'Counterparty', 'Chain', 'Interactions', 'In', 'Out'], rows: r.data.data.map((x) => [x.wallet_address, x.counterparty_address, chainName(x.chain), x.interaction_count, usd(x.volume_in_usd), usd(x.volume_out_usd)]) });
    } catch (e) { data.provenance.notes!.push(`${chain}: ${(e as Error).message.slice(0, 180)}`); }
  }
  return data;
}
