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

    if (token.startsWith('--')) {
      // Long option
      const [key, inlineValue] = token.slice(2).split('=')
      const argName = key.replace(/-/g, '_')
      const argSchema = argDefs[argName] ?? argDefs[key]

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
        rawValues[argName] = inlineValue
      } else {
        // Next token is the value
        i++
        if (i >= tokens.length) {
          return {
            ok: false,
            error: error('VALIDATION_ERROR', `Option --${key} requires a value`),
          }
        }
        rawValues[argName] = tokens[i]
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
        rawValues[found.name] = tokens[i]
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
 * Check if a Zod schema represents a flag (boolean with default)
 */
function isFlagSchema(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodDefault) {
    const inner = schema._def.innerType
    return inner instanceof z.ZodBoolean
  }
  return false
}

/**
 * Find argument by short key (first letter of name)
 */
function findArgByShortKey(
  defs: ArgsDefinition,
  shortKey: string,
): { name: string; schema: ArgSchema } | undefined {
  for (const [name, schema] of Object.entries(defs)) {
    if (name[0] === shortKey) {
      return { name, schema }
    }
  }
  return undefined
}
