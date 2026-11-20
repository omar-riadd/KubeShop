import { generateUUID } from '../lib/uuid';
import { getSessionId } from './session';
import { ApiError, ApiErrorCode } from './errors';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipSessionId?: boolean;
}

export async function apiClient<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 10000, skipSessionId = false, headers: customHeaders, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestId = generateUUID();
  const headers = new Headers(customHeaders);

  headers.set('X-Request-ID', requestId);
  if (!skipSessionId) {
    headers.set('X-Session-ID', getSessionId());
  }

  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError({
        status: 408,
        code: 'TIMEOUT',
        message: 'Request timed out. Please try again.',
        requestId,
      });
    }
    throw new ApiError({
      status: 0,
      code: 'NETWORK',
      message: 'Network error. Please check your connection.',
      requestId,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const responseRequestId = response.headers.get('X-Request-ID') || requestId;
  const contentType = response.headers.get('Content-Type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      try {
        const errorJson = await response.json();
        const errObj = errorJson?.error;
        if (errObj && errObj.code) {
          throw new ApiError({
            status: response.status,
            code: errObj.code as ApiErrorCode,
            message: errObj.message || 'Request failed',
            requestId: errObj.requestId || responseRequestId,
            details: errObj.details,
          });
        }
      } catch (parseErr) {
        if (parseErr instanceof ApiError) throw parseErr;
      }
    }

    // Fallback for non-JSON errors (Gateway 429/502/503/504 or malformed body)
    let code: ApiErrorCode = 'UNKNOWN';
    if (response.status === 502 || response.status === 503) {
      code = 'UPSTREAM_UNAVAILABLE';
    } else if (response.status === 504) {
      code = 'UPSTREAM_TIMEOUT';
    }

    throw new ApiError({
      status: response.status,
      code,
      message: 'Something went wrong. Please try again.',
      requestId: responseRequestId,
    });
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text as unknown as T;
}
