/**
 * Argument parser
 */

import { error, type AcliErrorResponse } from '../response/types';
import type { ArgumentDefinition, ParsedArgs } from '../router/registry';

export type ParseArgsResult =
  | { ok: true; value: ParsedArgs }
  | { ok: false; error: AcliErrorResponse }

/**
 * Parse argument tokens into a structured object
 */
export function parseArgs(
  tokens: string[],
  argDefs: Record<string, ArgumentDefinition>
): ParseArgsResult {
  const result: ParsedArgs = {}

  // Set defaults
  for (const [name, def] of Object.entries(argDefs)) {
    if (def.default !== undefined) {
      result[name] = def.default
    }
  }

  // Parse tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.startsWith('--')) {
      // Long option
      const [key, inlineValue] = token.slice(2).split('=')
      const argName = key.replace(/-/g, '_')
      const def = findArgDef(argDefs, key)

      if (!def) {
        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Unknown option: --${key}`, {
            hint: 'Check available options with help command',
          }),
        }
      }

      if (def.type === 'flag') {
        result[argName] = true
      } else if (inlineValue !== undefined) {
        const parsed = parseValue(inlineValue, def.type)
        if (parsed.error) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Invalid value for --${key}: ${parsed.error}`),
          }
        }
        result[argName] = parsed.value
      } else {
        // Next token is the value
        i++
        if (i >= tokens.length) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Option --${key} requires a value`),
          }
        }
        const parsed = parseValue(tokens[i], def.type)
        if (parsed.error) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Invalid value for --${key}: ${parsed.error}`),
          }
        }
        result[argName] = parsed.value
      }
    } else if (token.startsWith('-') && token.length === 2) {
      // Short option
      const key = token.slice(1)
      const def = findArgDefByShort(argDefs, key)

      if (!def) {
        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Unknown option: -${key}`),
        }
      }

      if (def.def.type === 'flag') {
        result[def.name] = true
      } else {
        i++
        if (i >= tokens.length) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Option -${key} requires a value`),
          }
        }
        const parsed = parseValue(tokens[i], def.def.type)
        if (parsed.error) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Invalid value for -${key}: ${parsed.error}`),
          }
        }
        result[def.name] = parsed.value
      }
    } else {
      // Positional argument (not implemented yet)
      // For now, ignore
    }
  }

  // Check required args
  for (const [name, def] of Object.entries(argDefs)) {
    if (def.required && result[name] === undefined) {
      return {
        ok: false,
        error: error('VALIDATION_ERROR', `Missing required argument: --${name}`, {
          hint: `Provide --${name} <value>`,
        }),
      }
    }
  }

  return { ok: true, value: result }
}

function findArgDef(
  defs: Record<string, ArgumentDefinition>,
  key: string
): ArgumentDefinition | undefined {
  // Try exact match
  if (defs[key]) return defs[key]
  // Try with underscores
  const underscore = key.replace(/-/g, '_')
  if (defs[underscore]) return defs[underscore]
  return undefined
}

function findArgDefByShort(
  defs: Record<string, ArgumentDefinition>,
  shortKey: string
): { name: string; def: ArgumentDefinition } | undefined {
  for (const [name, def] of Object.entries(defs)) {
    if (name[0] === shortKey) {
      return { name, def }
    }
  }
  return undefined
}

function parseValue(
  value: string,
  type: ArgumentDefinition['type']
): { value: unknown; error?: string } {
  switch (type) {
    case 'string':
      return { value }

    case 'integer': {
      const num = parseInt(value, 10)
      if (isNaN(num)) {
        return { value: undefined, error: 'expected integer' }
      }
      return { value: num }
    }

    case 'number': {
      const num = parseFloat(value)
      if (isNaN(num)) {
        return { value: undefined, error: 'expected number' }
      }
      return { value: num }
    }

    case 'boolean':
      if (value === 'true' || value === '1') return { value: true }
      if (value === 'false' || value === '0') return { value: false }
      return { value: undefined, error: 'expected true or false' }

    case 'flag':
      return { value: true }

    case 'datetime': {
      // Basic ISO8601 validation
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return { value: undefined, error: 'expected ISO8601 date' }
      }
      return { value: date }
    }

    case 'array':
      return { value: value.split(',') }

    default:
      return { value }
  }
}
