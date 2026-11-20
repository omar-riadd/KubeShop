import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats cents correctly into USD string', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(99)).toBe('$0.99');
    expect(formatMoney(100)).toBe('$1.00');
    expect(formatMoney(8900)).toBe('$89.00');
    expect(formatMoney(17800)).toBe('$178.00');
  });

  it('supports other currencies if specified', () => {
    expect(formatMoney(1000, 'EUR')).toContain('10.00');
  });
});
