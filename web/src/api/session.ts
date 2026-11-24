import { isUUIDv4, generateUUID } from '../lib/uuid';

const SESSION_KEY = 'kubeshop.sessionId';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredSession {
  id: string;
  expiresAt: number;
}

let memorySession: StoredSession | null = null;

function readValidSession(storage: Storage): string | null {
  const raw = storage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed?.id === 'string' &&
      isUUIDv4(parsed.id) &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > Date.now()
    ) {
      return parsed.id;
    }
  } catch {
    // Discard malformed or legacy unexpiring entries
  }
  storage.removeItem(SESSION_KEY);
  return null;
}

function writeSession(storage: Storage, id: string): void {
  const entry: StoredSession = { id, expiresAt: Date.now() + SESSION_TTL_MS };
  storage.setItem(SESSION_KEY, JSON.stringify(entry));
}

export function getSessionId(): string {
  try {
    const existing = readValidSession(sessionStorage);
    if (existing) return existing;
    const fresh = generateUUID();
    writeSession(sessionStorage, fresh);
    return fresh;
  } catch {
    // Fallback to localStorage with 24h TTL if sessionStorage is unavailable
    try {
      const existing = readValidSession(localStorage);
      if (existing) return existing;
      const fresh = generateUUID();
      writeSession(localStorage, fresh);
      return fresh;
    } catch {
      if (!memorySession || memorySession.expiresAt <= Date.now()) {
        memorySession = { id: generateUUID(), expiresAt: Date.now() + SESSION_TTL_MS };
      }
      return memorySession.id;
    }
  }
}

export function resetSessionId(): string {
  const fresh = generateUUID();
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    writeSession(sessionStorage, fresh);
  } catch {
    try {
      writeSession(localStorage, fresh);
    } catch {
      // ignore
    }
  }
  memorySession = { id: fresh, expiresAt: Date.now() + SESSION_TTL_MS };
  return fresh;
}
