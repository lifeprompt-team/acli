/**
 * Discovery commands: help, schema, version
 */

import { VERSION } from '../index'
import {
  type CommandDefinition,
  type CommandRegistry,
  findCommand,
  listCommands,
} from '../router/registry'

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
    examples?: string[]
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

  if (def.args) {
    result.arguments = Object.entries(def.args).map(([k, v]) => ({
      name: `--${k}`,
      type: v.type,
      required: v.required ?? false,
      default: v.default,
      description: v.description,
      examples: v.examples,
    }))
  }

  return result
}

function buildInputSchema(def: CommandDefinition): Record<string, unknown> {
  if (!def.args) {
    return { type: 'object', properties: {} }
  }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [name, argDef] of Object.entries(def.args)) {
    properties[name] = {
      type: mapTypeToJsonSchema(argDef.type),
      description: argDef.description,
      ...(argDef.default !== undefined && { default: argDef.default }),
    }
    if (argDef.required) {
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
  switch (type) {
    case 'integer':
      return 'integer'
    case 'number':
      return 'number'
    case 'boolean':
    case 'flag':
      return 'boolean'
    case 'datetime':
      return 'string' // with format: date-time
    case 'array':
      return 'array'
    default:
      return 'string'
  }
}
