/**
 * Standard error codes for acli
 */
export type AcliErrorCode =
  | 'PARSE_ERROR'
  | 'COMMAND_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'PATH_TRAVERSAL_BLOCKED'

/**
 * Error response structure
 */
export interface AcliError {
  error: {
    code: AcliErrorCode
    message: string
    hint?: string
    examples?: string[]
  }
}

/**
 * Create an error object
 */
export function error(
  code: AcliErrorCode,
  message: string,
  options?: { hint?: string; examples?: string[] },
): AcliError {
  return {
    error: {
      code,
      message,
      ...options,
    },
  }
}
