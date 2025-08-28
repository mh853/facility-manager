// lib/api-types.ts - Standardized API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: ApiMeta;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiMeta {
  requestId: string;
  version: string;
  duration?: number;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Common error codes
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resources
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // External Services
  GOOGLE_API_ERROR: 'GOOGLE_API_ERROR',
  GOOGLE_AUTH_ERROR: 'GOOGLE_AUTH_ERROR',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  
  // System
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Business Logic
  BUSINESS_NOT_FOUND: 'BUSINESS_NOT_FOUND',
  FACILITY_NOT_FOUND: 'FACILITY_NOT_FOUND',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  DUPLICATE_FILE: 'DUPLICATE_FILE',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// HTTP Status Code mappings
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

// Request handler type
export type ApiHandler<T = any> = (
  request: Request,
  context?: any
) => Promise<ApiResponse<T> | Response>;