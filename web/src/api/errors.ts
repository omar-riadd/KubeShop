export interface ApiErrorDetail {
  field: string;
  message: string;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'MISSING_SESSION'
  | 'PRODUCT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CART_EMPTY'
  | 'INVALID_TRANSITION'
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'FAULT_INJECTED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UNKNOWN'
  | 'NETWORK'
  | 'TIMEOUT';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId: string;
  readonly details?: ApiErrorDetail[];

  constructor(opts: {
    status: number;
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: ApiErrorDetail[];
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.details = opts.details;
  }
}

export function getUserErrorMessage(err: unknown): { message: string; requestId?: string } {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'VALIDATION_ERROR':
        return { message: 'Please check the highlighted fields.', requestId: err.requestId };
      case 'PRODUCT_NOT_FOUND':
        return { message: "That product doesn't exist.", requestId: err.requestId };
      case 'ORDER_NOT_FOUND':
        return { message: "We couldn't find that order.", requestId: err.requestId };
      case 'CART_EMPTY':
        return { message: 'Your cart is empty.', requestId: err.requestId };
      case 'MISSING_SESSION':
        return { message: 'Your session expired. Please try again.', requestId: err.requestId };
      case 'RATE_LIMIT_EXCEEDED':
        return {
          message: 'Too many requests. Please wait a moment and try again.',
          requestId: err.requestId,
        };
      default:
        return {
          message: 'Something went wrong. Please try again.',
          requestId: err.requestId,
        };
    }
  }

  if (err instanceof Error) {
    return { message: 'Something went wrong. Please try again.' };
  }

  return { message: 'An unexpected error occurred. Please try again.' };
}
