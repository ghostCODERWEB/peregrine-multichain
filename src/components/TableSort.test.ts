import { describe, expect, it } from 'vitest';
import { cellValue } from './TableSort';

describe('cellValue', () => {
  it('reads money, percents, multiples and signs', () => {
    expect(cellValue('$1.2M')).toBe(1.2e6);
    expect(cellValue('+$523.7K')).toBeCloseTo(523_700);
    expect(cellValue('−$3.29M')).toBe(-3.29e6);
    expect(cellValue('-12.5%')).toBe(-12.5);
    expect(cellValue('1.3×')).toBe(1.3);
    expect(cellValue('59h')).toBe(59);
    expect(cellValue('1,234')).toBe(1234);
  });
  it('returns null for text', () => {
    expect(cellValue('n/a')).toBeNull();
    expect(cellValue('PUMP')).toBeNull();
  });
});
