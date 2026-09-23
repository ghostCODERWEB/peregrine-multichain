import { describe, it, expect } from 'vitest';
import { layoutHexMap, HEX_GROUPS, hexPoints } from './hexmap-layout';
import { ALL_SUPPORTED_CHAINS } from '@/types/nansen/chain-enums';

const ALL = [...ALL_SUPPORTED_CHAINS.evm, ...ALL_SUPPORTED_CHAINS.nonEvm];

describe('HEX_GROUPS', () => {
  it('places every chain Nansen lists in exactly one group — no chain can silently drop off the map', () => {
    const placed = HEX_GROUPS.flatMap((g) => g.chains);
    expect(new Set(placed).size).toBe(placed.length); // no duplicates
    expect([...placed].sort()).toEqual([...ALL].sort());
  });
});

describe('layoutHexMap', () => {
  const layout = layoutHexMap();

  it('produces one tile per chain', () => {
    expect(layout.tiles).toHaveLength(ALL.length);
  });

  it('never overlaps two tiles (centres at least one hex width apart)', () => {
    const minDist = Math.sqrt(3) * layout.radius - 0.01;
    for (let i = 0; i < layout.tiles.length; i++) {
      for (let j = i + 1; j < layout.tiles.length; j++) {
        const a = layout.tiles[i], b = layout.tiles[j];
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy), `${a.chain}/${b.chain}`).toBeGreaterThanOrEqual(minDist);
      }
    }
  });

  it('keeps every tile inside the reported bounds', () => {
    // Pointy-top: vertices point up/down, so the vertical half-extent is r
    // but the horizontal half-extent is (sqrt(3)/2)·r.
    const halfW = (Math.sqrt(3) / 2) * layout.radius;
    for (const t of layout.tiles) {
      expect(t.cx - halfW, t.chain).toBeGreaterThanOrEqual(-0.5);
      expect(t.cy - layout.radius, t.chain).toBeGreaterThanOrEqual(-0.5);
      expect(t.cx + halfW, t.chain).toBeLessThanOrEqual(layout.width + 0.5);
      expect(t.cy + layout.radius, t.chain).toBeLessThanOrEqual(layout.height + 0.5);
    }
  });

  it('wraps clusters onto new rows when they exceed the max width', () => {
    const narrow = layoutHexMap(34, 400);
    expect(narrow.width).toBeLessThanOrEqual(Math.max(400, ...narrow.groups.map((g) => g.width)) + 1);
    expect(narrow.height).toBeGreaterThan(layout.height);
  });
});

describe('hexPoints', () => {
  it('returns six vertices at the given radius', () => {
    const pts = hexPoints(0, 0, 10).split(' ').map((p) => p.split(',').map(Number));
    expect(pts).toHaveLength(6);
    for (const [x, y] of pts) expect(Math.hypot(x, y)).toBeCloseTo(10, 1);
  });
});
