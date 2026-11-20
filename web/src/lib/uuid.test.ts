import { describe, it, expect } from 'vitest';
import { generateUUID, isUUID, isUUIDv4 } from './uuid';

describe('uuid utility', () => {
  it('generates a valid UUID v4', () => {
    const id = generateUUID();
    expect(isUUID(id)).toBe(true);
    expect(isUUIDv4(id)).toBe(true);
  });

  it('correctly validates UUID strings', () => {
    expect(isUUID('0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11')).toBe(true);
    expect(isUUIDv4('0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11')).toBe(true);
    expect(isUUID('invalid-uuid')).toBe(false);
    expect(isUUIDv4('invalid-uuid')).toBe(false);
  });
});
