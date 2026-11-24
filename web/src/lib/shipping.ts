export const DEFAULT_FREE_SHIPPING_THRESHOLDS: Record<string, number> = {
  USD: 7500, // $75.00
  EUR: 7500, // €75.00
  GBP: 6500, // £65.00
};

export function getFreeShippingThreshold(currency = 'USD'): number {
  return DEFAULT_FREE_SHIPPING_THRESHOLDS[currency.toUpperCase()] || 7500;
}

export interface FreeShippingProgress {
  thresholdCents: number;
  hasFreeShipping: boolean;
  remainingCents: number;
  progressPercent: number;
}

export function calculateFreeShippingProgress(
  subtotalCents: number,
  currency = 'USD'
): FreeShippingProgress {
  const thresholdCents = getFreeShippingThreshold(currency);
  const hasFreeShipping = subtotalCents >= thresholdCents;
  const remainingCents = Math.max(0, thresholdCents - subtotalCents);
  const progressPercent = Math.min(100, Math.round((subtotalCents / thresholdCents) * 100));

  return {
    thresholdCents,
    hasFreeShipping,
    remainingCents,
    progressPercent,
  };
}
