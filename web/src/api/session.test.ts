import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSessionId, resetSessionId } from './session';
import { isUUIDv4 } from '../lib/uuid';

describe('session manager', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('generates and persists a valid session ID in sessionStorage with TTL', () => {
    const s1 = getSessionId();
    expect(isUUIDv4(s1)).toBe(true);
    expect(localStorage.getItem('kubeshop.sessionId')).toBeNull();

    const raw = sessionStorage.getItem('kubeshop.sessionId');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { id: string; expiresAt: number };
    expect(parsed.id).toBe(s1);
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());

    const s2 = getSessionId();
    expect(s2).toBe(s1);
  });

  it('regenerates session ID when stored session is expired', () => {
    const expiredId = '0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11';
    sessionStorage.setItem(
      'kubeshop.sessionId',
      JSON.stringify({ id: expiredId, expiresAt: Date.now() - 1000 }),
    );
    const fresh = getSessionId();
    expect(isUUIDv4(fresh)).toBe(true);
    expect(fresh).not.toBe(expiredId);
  });

  it('can reset the session ID and clears legacy localStorage entry', () => {
    localStorage.setItem('kubeshop.sessionId', 'legacy-session');
    const s1 = getSessionId();
    const s2 = resetSessionId();
    expect(isUUIDv4(s2)).toBe(true);
    expect(s2).not.toBe(s1);
    expect(getSessionId()).toBe(s2);
    expect(localStorage.getItem('kubeshop.sessionId')).toBeNull();
  });
});
