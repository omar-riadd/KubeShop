import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId, resetSessionId } from './session';
import { isUUIDv4 } from '../lib/uuid';

describe('session manager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates and persists a valid session ID', () => {
    const s1 = getSessionId();
    expect(isUUIDv4(s1)).toBe(true);
    const s2 = getSessionId();
    expect(s2).toBe(s1);
  });

  it('can reset the session ID', () => {
    const s1 = getSessionId();
    const s2 = resetSessionId();
    expect(isUUIDv4(s2)).toBe(true);
    expect(s2).not.toBe(s1);
    expect(getSessionId()).toBe(s2);
  });
});
