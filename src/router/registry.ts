/**
 * Command registry and definition helpers
 */

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
export function findCommand(
  registry: CommandRegistry,
  path: string[]
): CommandDefinition | null {
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
  tokens: string[]
): [string[], string[]] {
  const path: string[] = []
  let currentRegistry: CommandRegistry | undefined = registry
  let currentCommand: CommandDefinition | undefined = undefined
  let i = 0

  for (; i < tokens.length; i++) {
    const token = tokens[i]
    
    // Stop if we hit an option
    if (token.startsWith('-')) break

    if (currentRegistry && currentRegistry[token]) {
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
  prefix: string[] = []
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
