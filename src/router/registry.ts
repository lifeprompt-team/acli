/**
 * Command registry and definition helpers
 */

import { type ZodType, z } from 'zod'

// ============================================================================
// Zod-based Argument Schema
// ============================================================================

/**
 * Metadata for CLI argument (positional index, examples, etc.)
 */
export interface ArgMeta {
  /** Position index for positional arguments (0-based). Allows `add 10 20` instead of `add --a 10 --b 20` */
  positional?: number
  /** Example values for help text */
  examples?: string[]
}

/**
 * Argument schema wrapper combining Zod schema with CLI metadata
 */
export interface ArgSchema<T = unknown> {
  schema: ZodType<T>
  meta: ArgMeta
}

/**
 * Create an argument schema with metadata
 *
 * @example
 * const args = {
 *   name: arg(z.string(), { positional: 0 }),
 *   count: arg(z.coerce.number().int().default(10)),
 *   verbose: arg(z.boolean().default(false)),
 * }
 */
export function arg<T>(
  schema: ZodType<T>,
  meta: ArgMeta = {},
): ArgSchema<T> {
  return { schema, meta }
}

/**
 * Type for args definition using Zod schemas
 */
export type ArgsDefinition = Record<string, ArgSchema>

/**
 * Infer the parsed args type from an ArgsDefinition
 *
 * @example
 * const argsDef = {
 *   name: arg(z.string()),
 *   count: arg(z.coerce.number().default(10)),
 * }
 * type Args = InferArgs<typeof argsDef>
 * // { name: string; count: number }
 */
export type InferArgs<T extends ArgsDefinition> = {
  [K in keyof T]: T[K] extends ArgSchema<infer U> ? U : never
}

// ============================================================================
// Legacy ArgumentDefinition (for backward compatibility)
// ============================================================================

export type ArgumentType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'flag'
  | 'datetime'
  | 'array'

export interface ArgumentDefinition {
  type: ArgumentType
  description?: string
  required?: boolean
  default?: unknown
  examples?: string[]
  /** Position index for positional arguments (0-based). Allows `add 10 20` instead of `add --a 10 --b 20` */
  positional?: number
}

/**
 * Convert legacy ArgumentDefinition to Zod-based ArgSchema
 */
export function legacyToZodSchema(def: ArgumentDefinition): ArgSchema {
  let schema: ZodType

  switch (def.type) {
    case 'string':
      schema = z.string()
      break
    case 'integer':
      schema = z.coerce.number().int()
      break
    case 'number':
      schema = z.coerce.number()
      break
    case 'boolean':
      schema = z.preprocess((val) => {
        if (val === 'true' || val === '1') return true
        if (val === 'false' || val === '0') return false
        return val
      }, z.boolean())
      break
    case 'flag':
      schema = z.boolean().default(false)
      break
    case 'datetime':
      schema = z.coerce.date()
      break
    case 'array':
      schema = z.preprocess((val) => {
        if (typeof val === 'string') return val.split(',')
        return val
      }, z.array(z.string()))
      break
    default:
      schema = z.unknown()
  }

  // Apply default
  if (def.default !== undefined) {
    schema = schema.default(def.default)
  }

  // Apply optional (if not required and no default)
  if (!def.required && def.default === undefined && def.type !== 'flag') {
    schema = schema.optional()
  }

  return {
    schema,
    meta: {
      positional: def.positional,
      examples: def.examples,
    },
  }
}

/**
 * Convert legacy args definition to Zod-based definition
 */
export function convertLegacyArgs(
  args: Record<string, ArgumentDefinition>,
): ArgsDefinition {
  const result: ArgsDefinition = {}
  for (const [name, def] of Object.entries(args)) {
    result[name] = legacyToZodSchema(def)
  }
  return result
}

export interface CommandDefinition {
  description: string
  subcommands?: Record<string, CommandDefinition>
  args?: Record<string, ArgumentDefinition>
  handler?: (args: ParsedArgs) => Promise<unknown>
}

export type ParsedArgs = Record<string, unknown>

export type CommandRegistry = Record<string, CommandDefinition>

/**
 * Define commands with type safety
 */
export function defineCommands<T extends CommandRegistry>(commands: T): T {
  return commands
}

/**
 * Find a command definition by path
 */
export function findCommand(registry: CommandRegistry, path: string[]): CommandDefinition | null {
  if (path.length === 0) return null

  const first = registry[path[0]]
  if (!first) return null

  let current: CommandDefinition = first

  for (let i = 1; i < path.length; i++) {
    if (!current.subcommands) return current
    const next = current.subcommands[path[i]]
    if (!next) return current
    current = next
  }

  return current
}

/**
 * Get command path from tokens
 * Returns [commandPath, remainingArgs]
 */
export function extractCommandPath(
  registry: CommandRegistry,
  tokens: string[],
): [string[], string[]] {
  const path: string[] = []
  let currentRegistry: CommandRegistry | undefined = registry
  let currentCommand: CommandDefinition | undefined
  let i = 0

  for (; i < tokens.length; i++) {
    const token = tokens[i]

    // Stop if we hit an option
    if (token.startsWith('-')) break

    if (currentRegistry?.[token]) {
      path.push(token)
      currentCommand = currentRegistry[token]
      currentRegistry = currentCommand.subcommands
    } else {
      break
    }
  }

  return [path, tokens.slice(i)]
}

/**
 * List all available commands
 */
export function listCommands(
  registry: CommandRegistry,
  prefix: string[] = [],
): Array<{ name: string; description: string }> {
  const result: Array<{ name: string; description: string }> = []

  for (const [name, def] of Object.entries(registry)) {
    const fullName = [...prefix, name].join(' ')
    result.push({ name: fullName, description: def.description })

    if (def.subcommands) {
      result.push(...listCommands(def.subcommands, [...prefix, name]))
    }
  }

  return result
}
