/**
 * POSIX-like command tokenizer
 * Splits command string into argument array without shell execution
 */

import { type AcliErrorResponse, error } from '../response/types'

/**
 * Forbidden characters that could indicate injection attempts
 */
const FORBIDDEN_CHARS = /[;&|`$(){}[\]<>!\\]/

/**
 * Maximum constraints
 */
const MAX_COMMAND_LENGTH = 10000
const MAX_ARGS = 100
const MAX_ARG_LENGTH = 10000

export type TokenizeResult = { ok: true; value: string[] } | { ok: false; error: AcliErrorResponse }

/**
 * Tokenize a command string into an array of arguments
 * Handles single quotes, double quotes, and escape sequences
 */
export function tokenize(input: string): TokenizeResult {
  // Length check
  if (input.length > MAX_COMMAND_LENGTH) {
    return {
      ok: false,
      error: error(
        'PARSE_ERROR',
        `Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters`,
      ),
    }
  }

  // Check for forbidden characters
  const forbidden = input.match(FORBIDDEN_CHARS)
  if (forbidden) {
    return {
      ok: false,
      error: error('INJECTION_BLOCKED', `Forbidden character detected: "${forbidden[0]}"`, {
        hint: 'Remove shell metacharacters from the command',
      }),
    }
  }

  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let isEscaped = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    // Handle escape sequences
    if (isEscaped) {
      current += char
      isEscaped = false
      continue
    }

    // Backslash escape (only outside single quotes)
    if (char === '\\' && !inSingleQuote) {
      isEscaped = true
      continue
    }

    // Single quote handling
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    // Double quote handling
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    // Whitespace handling (token separator when not in quotes)
    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        if (current.length > MAX_ARG_LENGTH) {
          return {
            ok: false,
            error: error(
              'PARSE_ERROR',
              `Argument exceeds maximum length of ${MAX_ARG_LENGTH} characters`,
            ),
          }
        }
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  // Check for unclosed quotes
  if (inSingleQuote) {
    return {
      ok: false,
      error: error('PARSE_ERROR', 'Unclosed single quote', { hint: "Add closing '" }),
    }
  }
  if (inDoubleQuote) {
    return {
      ok: false,
      error: error('PARSE_ERROR', 'Unclosed double quote', { hint: 'Add closing "' }),
    }
  }

  // Add final token
  if (current) {
    if (current.length > MAX_ARG_LENGTH) {
      return {
        ok: false,
        error: error(
          'PARSE_ERROR',
          `Argument exceeds maximum length of ${MAX_ARG_LENGTH} characters`,
        ),
      }
    }
    tokens.push(current)
  }

  // Check max args
  if (tokens.length > MAX_ARGS) {
    return {
      ok: false,
      error: error('PARSE_ERROR', `Too many arguments (max: ${MAX_ARGS})`),
    }
  }

  return { ok: true, value: tokens }
}
