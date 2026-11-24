import { describe, it, expect } from 'vitest';
import { calculateFreeShippingProgress, getFreeShippingThreshold } from './shipping';

describe('shipping utility', () => {
  it('returns correct threshold for currencies', () => {
    expect(getFreeShippingThreshold('USD')).toBe(7500);
    expect(getFreeShippingThreshold('EUR')).toBe(7500);
    expect(getFreeShippingThreshold('GBP')).toBe(6500);
    expect(getFreeShippingThreshold('JPY')).toBe(7500); // fallback
  });

  it('calculates progress when under threshold', () => {
    const result = calculateFreeShippingProgress(3750, 'USD');
    expect(result.thresholdCents).toBe(7500);
    expect(result.hasFreeShipping).toBe(false);
    expect(result.remainingCents).toBe(3750);
    expect(result.progressPercent).toBe(50);
  });

  it('calculates progress when meeting or exceeding threshold', () => {
    const exact = calculateFreeShippingProgress(7500, 'USD');
    expect(exact.hasFreeShipping).toBe(true);
    expect(exact.remainingCents).toBe(0);
    expect(exact.progressPercent).toBe(100);

    const over = calculateFreeShippingProgress(12000, 'USD');
    expect(over.hasFreeShipping).toBe(true);
    expect(over.remainingCents).toBe(0);
    expect(over.progressPercent).toBe(100);
  });
});
