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

    if (token.startsWith('--')) {
      // Long option
      const eqIdx = token.indexOf('=', 2)
      const key = eqIdx === -1 ? token.slice(2) : token.slice(2, eqIdx)
      const inlineValue = eqIdx === -1 ? undefined : token.slice(eqIdx + 1)
      const argName = key.replace(/-/g, '_')
      const argSchema = argDefs[argName]

      if (!argSchema) {
        // Try --no- negation: if key starts with "no-", check if the rest is a boolean flag
        if (key.startsWith('no-') && key.length > 3 && inlineValue === undefined) {
          const negatedKey = key.slice(3)
          const negatedArgName = negatedKey.replace(/-/g, '_')
          const negatedSchema = argDefs[negatedArgName]

          if (negatedSchema && isBooleanSchema(negatedSchema.schema)) {
            rawValues[negatedArgName] = false
            continue
          }
          if (negatedSchema) {
            return {
              ok: false,
              error: error(
                'VALIDATION_ERROR',
                `Option --no-${negatedKey} can only be used with boolean flags`,
              ),
            }
          }
        }

        return {
          ok: false,
          error: error('VALIDATION_ERROR', `Unknown option: --${key}`, {
            hint: 'Check available options with help command',
          }),
        }
      }

      // Check if it's a flag (boolean with default)
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
    } else if (token.startsWith('-') && !token.startsWith('--') && token.length >= 2) {
      // Short option(s) - supports combining: -abc = -a -b -c, -Hvalue, -H=value
      const chars = token.slice(1)

      for (let ci = 0; ci < chars.length; ci++) {
        const shortKey = chars[ci]
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
          // This option takes a value — consume the rest of this token or the next token
          const remaining = chars.slice(ci + 1)

          if (remaining.length > 0) {
            // Attached value: -Hvalue or -H=value
            const value = remaining.startsWith('=') ? remaining.slice(1) : remaining
            setArgValue(rawValues, found.name, value, found.schema.schema)
          } else {
            // Next token is the value: -H value
            i++
            if (i >= tokens.length) {
              return {
                ok: false,
                error: error('VALIDATION_ERROR', `Option -${shortKey} requires a value`),
              }
            }
            setArgValue(rawValues, found.name, tokens[i], found.schema.schema)
          }
          break // Value-taking option consumes the rest; stop processing this token
        }
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

  // Pre-convert string values to expected types (CLI args are always strings)
  coerceRawValues(rawValues, argDefs)

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

    // Provide actionable hints based on error type
    let hint: string | undefined
    if (firstIssue.code === 'invalid_type') {
      const { expected, received } = firstIssue as { expected?: string; received?: string }
      if (received === 'undefined') {
        hint = `Provide --${path} <value>`
      } else if (
        received === 'string' &&
        (expected === 'number' || expected === 'bigint' || expected === 'date')
      ) {
        hint = `Use z.coerce.${expected}() instead of z.${expected}() in the arg definition`
      }
    }

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

// Safely access ZodEffects which may not exist in Zod v4
// (In v4, refinements are internal checks, not a wrapper class)
const ZodEffectsClass = typeof z.ZodEffects === 'function' ? z.ZodEffects : null

/**
 * Unwrap ZodOptional / ZodDefault / ZodEffects wrappers to get the inner schema type
 */
function unwrapSchema(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodOptional) return unwrapSchema(schema.unwrap())
  if (schema instanceof z.ZodDefault) return unwrapSchema(schema.removeDefault())
  if (ZodEffectsClass && schema instanceof ZodEffectsClass) {
    return unwrapSchema((schema as { innerType(): z.ZodType }).innerType())
  }
  return schema
}

/**
 * Check if the wrapper chain contains a ZodDefault
 */
function hasDefault(schema: z.ZodType): boolean {
  if (schema instanceof z.ZodDefault) return true
  if (schema instanceof z.ZodOptional) return hasDefault(schema.unwrap())
  return false
}

/**
 * Check if a Zod schema represents a boolean type (unwraps Optional/Default)
 */
function isBooleanSchema(schema: z.ZodType): boolean {
  return unwrapSchema(schema) instanceof z.ZodBoolean
}

/**
 * Check if a Zod schema represents a flag (boolean with default — presence means true)
 */
function isFlagSchema(schema: z.ZodType): boolean {
  return isBooleanSchema(schema) && hasDefault(schema)
}

/**
 * Check if a Zod schema represents an array type (unwraps Optional/Default)
 */
function isArraySchema(schema: z.ZodType): boolean {
  return unwrapSchema(schema) instanceof z.ZodArray
}

/**
 * Pre-convert string values to match expected schema types.
 * CLI arguments are always strings, so we convert before Zod validation.
 * Uses only instanceof checks (no _def access) for Zod v3/v4 compatibility.
 */
function coerceRawValues(rawValues: Record<string, unknown>, argDefs: ArgsDefinition): void {
  for (const [name, argSchema] of Object.entries(argDefs)) {
    const value = rawValues[name]
    if (value === undefined) continue

    const inner = unwrapSchema(argSchema.schema)

    if (typeof value === 'string') {
      if (inner instanceof z.ZodNumber) {
        rawValues[name] = Number(value)
      } else if (inner instanceof z.ZodBigInt) {
        try {
          rawValues[name] = BigInt(value)
        } catch {
          // Let Zod handle the validation error
        }
      } else if (inner instanceof z.ZodDate) {
        rawValues[name] = new Date(value)
      }
    } else if (Array.isArray(value)) {
      const elementSchema = getArrayElementSchema(inner)
      if (elementSchema instanceof z.ZodNumber) {
        rawValues[name] = value.map((v) => (typeof v === 'string' ? Number(v) : v))
      } else if (elementSchema instanceof z.ZodBigInt) {
        rawValues[name] = value.map((v) => {
          if (typeof v !== 'string') return v
          try {
            return BigInt(v)
          } catch {
            return v
          }
        })
      } else if (elementSchema instanceof z.ZodDate) {
        rawValues[name] = value.map((v) => (typeof v === 'string' ? new Date(v) : v))
      }
    }
  }
}

/**
 * Get the element schema of a ZodArray (using public .element getter)
 */
function getArrayElementSchema(schema: z.ZodType): z.ZodType | null {
  if (schema instanceof z.ZodArray) {
    return unwrapSchema(schema.element)
  }
  return null
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
