// Injected browser wallets (EIP-1193 for EVM, Phantom-style for Solana):
// just the calls TIDE makes. TIDE only ever asks for signatures the user
// approves in the wallet; it never sends a transaction.
type TideEip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
type TideSolanaWallet = {
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (m: Uint8Array, enc?: string) => Promise<{ signature: Uint8Array }>;
};

interface Window {
  ethereum?: TideEip1193;
  solana?: TideSolanaWallet & { isPhantom?: boolean };
  phantom?: { solana?: TideSolanaWallet };
}
