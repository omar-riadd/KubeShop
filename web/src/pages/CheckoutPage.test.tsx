import { describe, it, expect } from 'vitest';
import { checkoutSchema } from './CheckoutPage';

describe('checkoutSchema validation', () => {
  it('validates a correct payload', () => {
    const valid = {
      customer: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      },
      shippingAddress: {
        line1: '1 Analytical Way',
        line2: 'Apt 2',
        city: 'London',
        postalCode: 'EC1A 1BB',
        country: 'GB',
      },
    };
    const res = checkoutSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('fails if customer email is invalid', () => {
    const invalid = {
      customer: {
        name: 'Ada Lovelace',
        email: 'not-an-email',
      },
      shippingAddress: {
        line1: '1 Analytical Way',
        city: 'London',
        postalCode: 'EC1A 1BB',
        country: 'GB',
      },
    };
    const res = checkoutSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('email'))).toBe(true);
    }
  });

  it('fails if country code is not 2 uppercase letters', () => {
    const invalid = {
      customer: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      },
      shippingAddress: {
        line1: '1 Analytical Way',
        city: 'London',
        postalCode: 'EC1A 1BB',
        country: 'usa', // lowercase & 3 letters
      },
    };
    const res = checkoutSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});
