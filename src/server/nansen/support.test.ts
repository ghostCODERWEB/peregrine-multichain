import { expect, it } from 'vitest';
import { contractSupports } from './support';

it('all is an aggregation option, not permission to use an unsupported chain', () => {
  expect(contractSupports('POST /api/v1/profiler/address/pnl', 'all')).toBe(true);
  expect(contractSupports('POST /api/v1/profiler/address/pnl', 'base')).toBe(true);
  expect(contractSupports('POST /api/v1/profiler/address/pnl', 'bitcoin')).toBe(false);
});
