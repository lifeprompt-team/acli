/**
 * Discovery commands: help, schema, version
 */

import { type AcliResponse, success } from '../response/types'
import {
  type CommandDefinition,
  type CommandRegistry,
  findCommand,
  listCommands,
} from '../router/registry'

// Version constant (avoid circular import)
const VERSION = '0.1.0'

/**
 * Handle 'help' command
 */
export function handleHelp(registry: CommandRegistry, args: string[]): AcliResponse {
  if (args.length === 0) {
    // Root help
    const commands = listCommands(registry)
    return success({
      description: 'acli - Agent CLI',
      commands: commands.filter((c) => !c.name.includes(' ')), // Top-level only
      usage: '<command> [subcommand] [options]',
      examples: commands.slice(0, 3).map((c) => c.name),
    })
  }

  // Specific command help
  const commandDef = findCommand(registry, args)
  if (!commandDef) {
    return success({
      description: `Command '${args.join(' ')}' not found`,
      commands: listCommands(registry).filter((c) => !c.name.includes(' ')),
    })
  }

  return success(formatCommandHelp(args.join(' '), commandDef))
}

/**
 * Handle 'schema' command
 */
export function handleSchema(registry: CommandRegistry, args: string[]): AcliResponse {
  if (args.length === 0) {
    // Full schema
    return success({
      commands: buildSchemaTree(registry),
    })
  }

  // Specific command schema
  const commandDef = findCommand(registry, args)
  if (!commandDef) {
    return success({
      error: `Command '${args.join(' ')}' not found`,
    })
  }

  return success({
    command: args.join(' '),
    inputSchema: buildInputSchema(commandDef),
    outputSchema: { type: 'object' }, // Generic for now
  })
}

/**
 * Handle 'version' command
 */
export function handleVersion(): AcliResponse {
  return success({
    acli_version: VERSION,
    implementation: {
      name: 'acli',
      version: VERSION,
    },
    capabilities: {
      extensions: [],
    },
  })
}

function formatCommandHelp(name: string, def: CommandDefinition): Record<string, unknown> {
  const result: Record<string, unknown> = {
    command: name,
    description: def.description,
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
