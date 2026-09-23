// Lays out every chain Nansen lists as pointy-top hex tiles, clustered by
// ecosystem. Pure geometry: chain ids in, tile centres out. The groups are
// editorial (what a reader would expect to see side by side); every chain
// in the registry must land in exactly one — hexmap-layout.test.ts checks
// that against the full roster so a chain can't silently drop off the map.

export interface HexGroup {
  id: string;
  label: string;
  chains: string[];
  /** Hexes per row inside this cluster. */
  cols: number;
}

export const HEX_GROUPS: HexGroup[] = [
  { id: 'evm-l1', label: 'EVM L1s', cols: 4, chains: ['ethereum', 'bnb', 'avalanche', 'sonic', 'monad', 'sei', 'hyperevm', 'plasma', 'arc', 'chiliz', 'iotaevm', 'viction'] },
  { id: 'evm-l2', label: 'EVM L2s', cols: 4, chains: ['base', 'arbitrum', 'optimism', 'robinhood', 'polygon', 'linea', 'mantle', 'katana', 'metis', 'gravity'] },
  { id: 'svm-move', label: 'Solana & Move', cols: 3, chains: ['solana', 'sui', 'aptos'] },
  { id: 'bitcoin', label: 'Bitcoin family', cols: 2, chains: ['bitcoin', 'citrea', 'stacks', 'bitlayer'] },
  { id: 'other', label: 'Other L1s', cols: 4, chains: ['tron', 'ton', 'near', 'starknet', 'injective', 'mantra', 'stellar', 'algorand'] },
  { id: 'perp', label: 'Perps', cols: 1, chains: ['hyperliquid'] },
];

export interface HexTile {
  chain: string;
  group: string;
  cx: number;
  cy: number;
}

export interface GroupFrame {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HexLayout {
  radius: number;
  width: number;
  height: number;
  tiles: HexTile[];
  groups: GroupFrame[];
}

const SQRT3 = Math.sqrt(3);

/** Pointy-top hex polygon points around (cx, cy). */
export function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/**
 * Clusters are placed left-to-right in rows that wrap at `maxWidth`, each
 * cluster an offset hex grid (odd rows shifted half a hex) with a label
 * band above it. Returns the bounding size so the SVG viewBox fits exactly.
 */
export function layoutHexMap(radius = 34, maxWidth = 1100, gap = 36): HexLayout {
  const hexW = SQRT3 * radius;          // centre-to-centre horizontally
  const rowH = 1.5 * radius;            // centre-to-centre vertically
  const labelH = 26;

  const tiles: HexTile[] = [];
  const groups: GroupFrame[] = [];
  let x = 0;
  let y = 0;
  let rowMaxH = 0;

  for (const g of HEX_GROUPS) {
    const rows = Math.ceil(g.chains.length / g.cols);
    const offsetNeeded = rows > 1 ? 0.5 : 0;
    const width = hexW * (g.cols + offsetNeeded);
    const height = labelH + radius * 2 + rowH * (rows - 1);

    if (x > 0 && x + width > maxWidth) {
      x = 0;
      y += rowMaxH + gap;
      rowMaxH = 0;
    }

    g.chains.forEach((chain, i) => {
      const row = Math.floor(i / g.cols);
      const col = i % g.cols;
      tiles.push({
        chain,
        group: g.id,
        cx: x + hexW / 2 + col * hexW + (row % 2 === 1 ? hexW / 2 : 0),
        cy: y + labelH + radius + row * rowH,
      });
    });
    groups.push({ id: g.id, label: g.label, x, y, width, height });

    x += width + gap;
    rowMaxH = Math.max(rowMaxH, height);
  }

  const width = Math.max(...groups.map((g) => g.x + g.width));
  const height = y + rowMaxH;
  return { radius, width: Math.ceil(width), height: Math.ceil(height), tiles, groups };
}
