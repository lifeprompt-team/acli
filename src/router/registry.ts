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
  /** Description for help text */
  description?: string
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
export function arg<T>(schema: ZodType<T>, meta: ArgMeta = {}): ArgSchema<T> {
  return { schema, meta }
}

/**
 * Create a comma-separated array argument
 *
 * Accepts a comma-separated string and splits it into an array.
 * Optionally applies a Zod schema to validate/transform each element.
 *
 * @example
 * ```typescript
 * const args = {
 *   // String array: --tags "a,b,c" → ["a", "b", "c"]
 *   tags: csvArg(),
 *
 *   // Number array: --ids "1,2,3" → [1, 2, 3]
 *   ids: csvArg({ item: z.coerce.number() }),
 *
 *   // With metadata
 *   emails: csvArg({ item: z.string().email(), meta: { description: "Email list" } }),
 * }
 * ```
 */
export function csvArg<T = string>(
  options: {
    /** Zod schema for each element (default: z.string()) */
    item?: ZodType<T>
    /** Argument metadata (positional, description, examples) */
    meta?: ArgMeta
    /** Separator (default: ",") */
    separator?: string
  } = {},
): ArgSchema<T[]> {
  const { item, meta = {}, separator = ',' } = options
  const itemSchema = item ?? (z.string() as unknown as ZodType<T>)

  const schema = z
    .string()
    .transform((s) => s.split(separator).map((v) => v.trim()))
    .pipe(z.array(itemSchema))

  return { schema: schema as unknown as ZodType<T[]>, meta }
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
// Command Definition
// ============================================================================

export interface CommandDefinition<TArgs extends ArgsDefinition = ArgsDefinition> {
  description: string
  subcommands?: CommandRegistry
  args?: TArgs
  handler?: (args: InferArgs<TArgs>) => Promise<unknown>
}

// biome-ignore lint/suspicious/noExplicitAny: Allows type-safe defineCommand results to be used in registry
export type CommandRegistry = Record<string, CommandDefinition<any>>

/**
 * Define a command with full type inference for handler args
 *
 * @example
 * import { z } from "zod"
 * import { defineCommand, arg, registerAcli } from "@lifeprompt/acli"
 *
 * const add = defineCommand({
 *   description: 'Add two numbers',
 *   args: {
 *     a: arg(z.coerce.number()),
 *     b: arg(z.coerce.number()),
 *   },
 *   handler: async ({ a, b }) => ({ result: a + b }),  // a, b are inferred as number
 * })
 *
 * const multiply = defineCommand({ ... })
 *
 * // Pass commands directly to registerAcli
 * registerAcli(server, { add, multiply }, { name: "math" })
 */
export function defineCommand<TArgs extends ArgsDefinition>(
  command: CommandDefinition<TArgs>,
): CommandDefinition<TArgs> {
  return command
}

/**
 * Short alias for defineCommand - use inside subcommands for cleaner inline definitions
 *
 * @example
 * import { z } from "zod"
 * import { defineCommand, cmd, arg, registerAcli } from "@lifeprompt/acli"
 *
 * const math = defineCommand({
 *   description: 'Math operations',
 *   subcommands: {
 *     add: cmd({
 *       description: 'Add two numbers',
 *       args: { a: arg(z.coerce.number()), b: arg(z.coerce.number()) },
 *       handler: async ({ a, b }) => ({ result: a + b }),
 *     }),
 *     multiply: cmd({
 *       description: 'Multiply two numbers',
 *       args: { a: arg(z.coerce.number()), b: arg(z.coerce.number()) },
 *       handler: async ({ a, b }) => ({ result: a * b }),
 *     }),
 *   },
 * })
 */
export const cmd = defineCommand

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
