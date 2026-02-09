/**
 * Argument parser using Zod schemas
 */

import { z } from 'zod'
import { type AcliError, error } from '../response/types'
import type { ArgSchema, ArgsDefinition, InferArgs } from '../router/registry'

export type ParseArgsResult<T> = { ok: true; value: T } | { ok: false; error: AcliError }

/**
 * Parse argument tokens into a structured object using Zod schemas
 */
export function parseArgs<T extends ArgsDefinition>(
  tokens: string[],
  argDefs: T,
): ParseArgsResult<InferArgs<T>> {
  const rawValues: Record<string, unknown> = {}

  // Build positional args map: position -> { name, schema }
  const positionalArgs = new Map<number, { name: string; schema: ArgSchema }>()
  for (const [name, argSchema] of Object.entries(argDefs)) {
    if (argSchema.meta.positional !== undefined) {
      positionalArgs.set(argSchema.meta.positional, { name, schema: argSchema })
    }
  }

  // Collect positional values (non-option tokens)
  const positionalValues: string[] = []

  // Parse tokens into raw values
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // End of options separator: everything after '--' is treated as positional
    if (token === '--') {
      for (let j = i + 1; j < tokens.length; j++) {
        positionalValues.push(tokens[j])
      }
      break
    }

    if (token.startsWith('--no-') && token.length > 5) {
      // --no- prefix: negate a boolean flag
      const key = token.slice(5)
      const argName = key.replace(/-/g, '_')
      const argSchema = argDefs[argName]

      if (!argSchema) {
        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Unknown option: ${token}`, {
            hint: 'Check available options with help command',
          }),
        }
      }

      if (!isBooleanSchema(argSchema.schema)) {
        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Option --no-${key} can only be used with boolean flags`),
        }
      }

      rawValues[argName] = false
    } else if (token.startsWith('--')) {
      // Long option
      const [key, inlineValue] = token.slice(2).split('=')
      const argName = key.replace(/-/g, '_')
      const argSchema = argDefs[argName]

      if (!argSchema) {
        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Unknown option: --${key}`, {
            hint: 'Check available options with help command',
          }),
        }
      }

      // Check if it's a flag (boolean with default false)
      const isFlag = isFlagSchema(argSchema.schema)

      if (isFlag) {
        rawValues[argName] = true
      } else if (inlineValue !== undefined) {
        setArgValue(rawValues, argName, inlineValue, argSchema.schema)
      } else {
        // Next token is the value
        i++
        if (i >= tokens.length) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Option --${key} requires a value`),
          }
        }
        setArgValue(rawValues, argName, tokens[i], argSchema.schema)
      }
    } else if (token.startsWith('-') && token.length === 2) {
      // Short option
      const shortKey = token.slice(1)
      const found = findArgByShortKey(argDefs, shortKey)

      if (!found) {
        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Unknown option: -${shortKey}`),
        }
      }

      const isFlag = isFlagSchema(found.schema.schema)

      if (isFlag) {
        rawValues[found.name] = true
      } else {
        i++
        if (i >= tokens.length) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Option -${shortKey} requires a value`),
          }
        }
        setArgValue(rawValues, found.name, tokens[i], found.schema.schema)
      }
    } else {
      // Positional argument - collect for later processing
      positionalValues.push(token)
    }
  }

  // Process positional arguments
  for (let pos = 0; pos < positionalValues.length; pos++) {
    const argInfo = positionalArgs.get(pos)
    if (argInfo && rawValues[argInfo.name] === undefined) {
      rawValues[argInfo.name] = positionalValues[pos]
    }
  }

  // Build Zod object schema and validate
  const schemaShape: Record<string, z.ZodType> = {}
  for (const [name, argSchema] of Object.entries(argDefs)) {
    schemaShape[name] = argSchema.schema
  }

  const objectSchema = z.object(schemaShape)
  const parseResult = objectSchema.safeParse(rawValues)

  if (!parseResult.success) {
    const issues = parseResult.error.issues
    const firstIssue = issues[0]
    const path = firstIssue.path.join('.')
    const message = path ? `Invalid value for ${path}: ${firstIssue.message}` : firstIssue.message

    // Provide hint for missing required fields
    const hint =
      firstIssue.code === 'invalid_type' &&
      (firstIssue as { received?: string }).received === 'undefined'
        ? `Provide --${path} <value>`
        : undefined

    return {
      ok: false,
      error: error('VALIDATION_ERROR', message, hint ? { hint } : undefined),
    }
  }

  return { ok: true, value: parseResult.data as InferArgs<T> }
}

/**
 * Set an argument value, accumulating into an array if the schema is an array type
 */
function setArgValue(
  rawValues: Record<string, unknown>,
  name: string,
  value: string,
  schema: z.ZodType,
): void {
  if (isArraySchema(schema)) {
    const existing = rawValues[name]
    if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      rawValues[name] = [value]
    }
  } else {
    rawValues[name] = value
  }
}

/**
 * Check if a Zod schema represents a flag (boolean with default)
 */
function isFlagSchema(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodDefault) {
    const inner = schema.removeDefault()
    return inner instanceof z.ZodBoolean
  }
  return false
}

/**
 * Check if a Zod schema represents an array type (supports ZodArray, ZodDefault<ZodArray>, ZodOptional<ZodArray>)
 */
function isArraySchema(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodArray) return true
  if (schema instanceof z.ZodDefault) {
    return schema.removeDefault() instanceof z.ZodArray
  }
  if (schema instanceof z.ZodOptional) {
    return schema.unwrap() instanceof z.ZodArray
  }
  return false
}

/**
 * Check if a Zod schema represents a boolean type (supports ZodBoolean, ZodDefault<ZodBoolean>, ZodOptional<ZodBoolean>)
 */
function isBooleanSchema(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodBoolean) return true
  if (schema instanceof z.ZodDefault) {
    return schema.removeDefault() instanceof z.ZodBoolean
  }
  if (schema instanceof z.ZodOptional) {
    return schema.unwrap() instanceof z.ZodBoolean
  }
  return false
}

/**
 * Find argument by explicit short alias defined in meta.short
 */
function findArgByShortKey(
  defs: ArgsDefinition,
  shortKey: string,
): { name: string; schema: ArgSchema } | undefined {
  for (const [name, schema] of Object.entries(defs)) {
    if (schema.meta.short === shortKey) {
      return { name, schema }
    }
  }
  return undefined
}
