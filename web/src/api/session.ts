import { isUUIDv4, generateUUID } from '../lib/uuid';

const SESSION_KEY = 'kubeshop.sessionId';
let memorySessionId: string | null = null;

export function getSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored && isUUIDv4(stored)) {
      return stored;
    }
    const fresh = generateUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    if (!memorySessionId) {
      memorySessionId = generateUUID();
    }
    return memorySessionId;
  }
}

export function resetSessionId(): string {
  const fresh = generateUUID();
  try {
    localStorage.setItem(SESSION_KEY, fresh);
  } catch {
    // ignore
  }
  memorySessionId = fresh;
  return fresh;
}
