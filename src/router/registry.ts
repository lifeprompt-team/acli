/**
 * Command registry and definition helpers
 */

import type { ZodType } from 'zod'

// ============================================================================
// Zod-based Argument Schema
// ============================================================================

/**
 * Metadata for CLI argument (positional index, examples, etc.)
 */
export interface ArgMeta {
  /** Position index for positional arguments (0-based). Allows `add 10 20` instead of `add --a 10 --b 20` */
  positional?: number
  /** Single-character short option alias (e.g., 'v' for -v). Only works when explicitly set. */
  short?: string
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

// ============================================================================
// MCP Tool Migration Helper
// ============================================================================

/**
 * MCP-style tool definition for migration
 *
 * This interface represents a typical MCP tool definition that can be
 * converted to ACLI commands using the `aclify` function.
 */
export interface McpToolLike {
  /** Tool name (becomes command name) */
  name: string
  /** Tool description */
  description: string
  /** Zod schema object for input validation */
  inputSchema: Record<string, ZodType>
  /** Handler function */
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

/**
 * Convert MCP-style tool definitions to ACLI CommandRegistry
 *
 * This is a migration helper for converting existing MCP tools to ACLI format.
 * All arguments become named arguments (no positional support).
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { aclify, registerAcli } from "@lifeprompt/acli";
 *
 * // Existing MCP-style tool definitions
 * const mcpTools = [
 *   {
 *     name: "add",
 *     description: "Add two numbers",
 *     inputSchema: { a: z.number(), b: z.number() },
 *     handler: async ({ a, b }) => ({ result: a + b }),
 *   },
 *   {
 *     name: "multiply",
 *     description: "Multiply two numbers",
 *     inputSchema: { a: z.number(), b: z.number() },
 *     handler: async ({ a, b }) => ({ result: a * b }),
 *   },
 * ];
 *
 * // Convert to ACLI commands
 * const commands = aclify(mcpTools);
 *
 * // Register with MCP server
 * registerAcli(server, commands, { name: "math" });
 * ```
 *
 * @param tools - Array of MCP-style tool definitions
 * @returns CommandRegistry for use with registerAcli
 */
export function aclify(tools: McpToolLike[]): CommandRegistry {
  const registry: CommandRegistry = {}

  for (const tool of tools) {
    const args: ArgsDefinition = {}
    for (const [key, schema] of Object.entries(tool.inputSchema)) {
      args[key] = arg(schema)
    }
    registry[tool.name] = {
      description: tool.description,
      args,
      handler: tool.handler,
    }
  }

  return registry
}
