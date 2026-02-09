/**
 * Discovery commands: help, schema, version
 */

import { z } from 'zod'
import { VERSION } from '../index'
import type { ArgSchema, CommandDefinition, CommandRegistry } from '../router/registry'
import { findCommand, listCommands } from '../router/registry'

/**
 * Help response type
 */
export interface HelpResponse {
  description: string
  commands?: Array<{ name: string; description: string }>
  usage?: string
  examples?: string[]
  command?: string
  subcommands?: Array<{ name: string; description: string }>
  arguments?: Array<{
    name: string
    type: string
    required: boolean
    default?: unknown
    description?: string
    positional?: number
    examples?: string[]
    short?: string
    negatable?: boolean
  }>
}

/**
 * Schema response type
 */
export interface SchemaResponse {
  commands?: Record<string, unknown>
  command?: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  error?: string
}

/**
 * Version response type
 */
export interface VersionResponse {
  acli_version: string
  implementation: {
    name: string
    version: string
  }
  capabilities: {
    extensions: string[]
  }
}

/**
 * Handle 'help' command
 */
export function handleHelp(registry: CommandRegistry, args: string[]): HelpResponse {
  if (args.length === 0) {
    // Root help
    const commands = listCommands(registry)
    return {
      description: 'acli - Agent CLI',
      commands: commands.filter((c) => !c.name.includes(' ')), // Top-level only
      usage: '<command> [subcommand] [options]',
      examples: commands.slice(0, 3).map((c) => c.name),
    }
  }

  // Specific command help
  const commandDef = findCommand(registry, args)
  if (!commandDef) {
    return {
      description: `Command '${args.join(' ')}' not found`,
      commands: listCommands(registry).filter((c) => !c.name.includes(' ')),
    }
  }

  return formatCommandHelp(args.join(' '), commandDef)
}

/**
 * Handle 'schema' command
 */
export function handleSchema(registry: CommandRegistry, args: string[]): SchemaResponse {
  if (args.length === 0) {
    // Full schema
    return {
      commands: buildSchemaTree(registry),
    }
  }

  // Specific command schema
  const commandDef = findCommand(registry, args)
  if (!commandDef) {
    return {
      error: `Command '${args.join(' ')}' not found`,
    }
  }

  return {
    command: args.join(' '),
    inputSchema: buildInputSchema(commandDef),
    outputSchema: { type: 'object' }, // Generic for now
  }
}

/**
 * Handle 'version' command
 */
export function handleVersion(): VersionResponse {
  return {
    acli_version: VERSION,
    implementation: {
      name: 'acli',
      version: VERSION,
    },
    capabilities: {
      extensions: [],
    },
  }
}

/**
 * Extract schema info from a Zod schema
 */
function getSchemaInfo(argSchema: ArgSchema): {
  type: string
  required: boolean
  default?: unknown
} {
  let schema = argSchema.schema
  let isRequired = true
  let defaultValue: unknown

  // Unwrap ZodOptional / ZodDefault in any order (handles nesting like Optional<Default<T>> or Default<Optional<T>>)
  let changed = true
  while (changed) {
    changed = false
    if (schema instanceof z.ZodOptional) {
      isRequired = false
      schema = schema.unwrap()
      changed = true
    }
    if (schema instanceof z.ZodDefault) {
      isRequired = false
      // Zod v3 has no public API to read default values; _def.defaultValue() is the only way
      defaultValue = schema._def.defaultValue()
      schema = schema.removeDefault()
      changed = true
    }
  }

  // Unwrap ZodEffects (preprocess, transform, refine)
  while (schema instanceof z.ZodEffects) {
    schema = schema.innerType()
  }

  // Get type name
  const type = getZodTypeName(schema)

  return { type, required: isRequired, default: defaultValue }
}

/**
 * Get a human-readable type name from a Zod schema
 */
function getZodTypeName(schema: z.ZodType): string {
  if (schema instanceof z.ZodString) return 'string'
  if (schema instanceof z.ZodNumber) return 'number'
  if (schema instanceof z.ZodBoolean) return 'boolean'
  if (schema instanceof z.ZodDate) return 'datetime'
  if (schema instanceof z.ZodArray) {
    const elementType = getZodTypeName(schema.element)
    return `${elementType}[]`
  }
  if (schema instanceof z.ZodEnum) return 'enum'
  if (schema instanceof z.ZodLiteral) return 'literal'
  if (schema instanceof z.ZodUnion) return 'union'
  return 'unknown'
}

/**
 * Precomputed argument info for help output (avoids redundant getSchemaInfo calls)
 */
interface ArgHelpInfo {
  argName: string
  meta: ArgSchema['meta']
  type: string
  required: boolean
  default?: unknown
  isPositional: boolean
  isBoolean: boolean
  isArray: boolean
}

function formatCommandHelp(name: string, def: CommandDefinition): HelpResponse {
  const result: HelpResponse = {
    description: def.description,
    command: name,
  }

  if (def.subcommands) {
    result.subcommands = Object.entries(def.subcommands).map(([k, v]) => ({
      name: k,
      description: v.description,
    }))
  }

  if (def.args && Object.keys(def.args).length > 0) {
    // Precompute schema info once per arg
    const argInfos: ArgHelpInfo[] = Object.entries(def.args).map(([k, v]) => {
      const info = getSchemaInfo(v)
      return {
        argName: k,
        meta: v.meta,
        type: info.type,
        required: info.required,
        default: info.default,
        isPositional: v.meta.positional !== undefined,
        isBoolean: info.type === 'boolean',
        isArray: info.type.endsWith('[]'),
      }
    })

    result.arguments = argInfos.map((a) => ({
      name: a.isPositional ? `<${a.argName}>` : `--${a.argName}`,
      type: a.type,
      required: a.required,
      ...(a.default !== undefined && { default: a.default }),
      ...(a.meta.description && { description: a.meta.description }),
      ...(a.isPositional && { positional: a.meta.positional }),
      ...(a.meta.short && { short: a.meta.short }),
      ...(a.isBoolean && { negatable: true }),
      ...(a.meta.examples && { examples: a.meta.examples }),
    }))

    result.usage = buildUsageLine(name, argInfos)
  }

  return result
}

/**
 * Build a usage line from command name and precomputed arg info
 */
function buildUsageLine(commandName: string, argInfos: ArgHelpInfo[]): string {
  const parts: string[] = [commandName]

  // Positionals first, sorted by position index
  const positionals = argInfos
    .filter((a) => a.isPositional)
    .sort((a, b) => (a.meta.positional ?? 0) - (b.meta.positional ?? 0))

  for (const p of positionals) {
    parts.push(p.required ? `<${p.argName}>` : `[<${p.argName}>]`)
  }

  // Named args
  const named = argInfos.filter((a) => !a.isPositional)
  for (const n of named) {
    const displayType = n.isArray ? n.type.slice(0, -2) : n.type

    if (n.isBoolean) {
      parts.push(`[--${n.argName}]`)
    } else if (n.required) {
      parts.push(n.isArray ? `--${n.argName} <${displayType}>...` : `--${n.argName} <${n.type}>`)
    } else {
      parts.push(
        n.isArray ? `[--${n.argName} <${displayType}>...]` : `[--${n.argName} <${n.type}>]`,
      )
    }
  }

  return parts.join(' ')
}

function buildInputSchema(def: CommandDefinition): Record<string, unknown> {
  if (!def.args) {
    return { type: 'object', properties: {} }
  }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [name, argSchema] of Object.entries(def.args)) {
    const info = getSchemaInfo(argSchema)
    properties[name] = {
      type: mapTypeToJsonSchema(info.type),
      ...(argSchema.meta.description && { description: argSchema.meta.description }),
      ...(info.default !== undefined && { default: info.default }),
    }
    if (info.required) {
      required.push(name)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  }
}

function buildSchemaTree(registry: CommandRegistry): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [name, def] of Object.entries(registry)) {
    result[name] = {
      description: def.description,
      ...(def.subcommands && { subcommands: buildSchemaTree(def.subcommands) }),
      ...(def.args && { inputSchema: buildInputSchema(def) }),
    }
  }

  return result
}

function mapTypeToJsonSchema(type: string): string {
  if (type.endsWith('[]')) return 'array'
  switch (type) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'datetime':
      return 'string' // with format: date-time
    default:
      return 'string'
  }
}
