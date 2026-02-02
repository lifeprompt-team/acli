/**
 * Standard error codes for acli
 */
export type AcliErrorCode =
  | 'PARSE_ERROR'
  | 'INJECTION_BLOCKED'
  | 'COMMAND_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'PATH_TRAVERSAL_BLOCKED'

/**
 * Metadata included in responses
 */
export interface AcliMeta {
  command: string
  duration_ms?: number
}

/**
 * Success response structure
 */
export interface AcliSuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
  _meta?: AcliMeta
}

/**
 * Error detail structure
 */
export interface AcliErrorDetail {
  code: AcliErrorCode
  message: string
  hint?: string
  examples?: string[]
}

/**
 * Error response structure
 */
export interface AcliErrorResponse {
  success: false
  error: AcliErrorDetail
  _meta?: AcliMeta
}

/**
 * Union type for all acli responses
 */
export type AcliResponse<T = unknown> = AcliSuccessResponse<T> | AcliErrorResponse

/**
 * Create a success response
 */
export function success<T>(data: T, message?: string): AcliSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  }
}

/**
 * Create an error response
 */
export function error(
  code: AcliErrorCode,
  message: string,
  options?: { hint?: string; examples?: string[] },
): AcliErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...options,
    },
  }
}
