import { describe, it, expect, vi } from 'vitest';
import { generateUUID, isUUID, isUUIDv4 } from './uuid';

describe('uuid utility', () => {
  it('generates a valid UUID v4', () => {
    const id = generateUUID();
    expect(isUUID(id)).toBe(true);
    expect(isUUIDv4(id)).toBe(true);
  });

  it('uses crypto.getRandomValues fallback when randomUUID is unavailable', () => {
    const originalRandomUUID = crypto.randomUUID;
    const getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues');
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const id = generateUUID();
      expect(getRandomValuesSpy).toHaveBeenCalledTimes(1);
      expect(isUUID(id)).toBe(true);
      expect(isUUIDv4(id)).toBe(true);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: originalRandomUUID, configurable: true });
      getRandomValuesSpy.mockRestore();
    }
  });

  it('correctly validates UUID strings', () => {
    expect(isUUID('0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11')).toBe(true);
    expect(isUUIDv4('0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11')).toBe(true);
    expect(isUUID('invalid-uuid')).toBe(false);
    expect(isUUIDv4('invalid-uuid')).toBe(false);
  });
});
