#!/usr/bin/env node

/**
 * acli CLI - Execute acli commands directly from terminal
 *
 * Usage:
 *   acli <command> [args...]
 *   acli help
 *   acli --version
 *
 * For tool developers:
 *   Create a wrapper script that imports and configures acli with your commands.
 */

import { handleHelp, handleSchema, handleVersion } from './discovery'
import { parseArgs } from './parser/args'
import { tokenize } from './parser/tokenizer'
import { type AcliResponse, error } from './response/types'
import {
  type CommandRegistry,
  extractCommandPath,
  findCommand,
  listCommands,
} from './router/registry'

/**
 * Execute command and return response
 */
async function executeCommand(command: string, commands: CommandRegistry): Promise<AcliResponse> {
  const startTime = Date.now()

  const tokenResult = tokenize(command)
  if (!tokenResult.ok) {
    return tokenResult.error
  }

  const tokens = tokenResult.value
  if (tokens.length === 0) {
    return error('PARSE_ERROR', 'Empty command', {
      hint: "Run 'help' for available commands",
    })
  }

  const firstToken = tokens[0]
  if (firstToken === 'help') {
    return handleHelp(commands, tokens.slice(1))
  }
  if (firstToken === 'schema') {
    return handleSchema(commands, tokens.slice(1))
  }
  if (firstToken === 'version') {
    return handleVersion()
  }

  const [commandPath, argTokens] = extractCommandPath(commands, tokens)
  if (commandPath.length === 0) {
    return error('COMMAND_NOT_FOUND', `Command '${firstToken}' not found`, {
      hint: "Run 'help' for available commands",
      examples: listCommands(commands)
        .slice(0, 3)
        .map((c) => c.name),
    })
  }

  const commandDef = findCommand(commands, commandPath)
  if (!commandDef) {
    return error('COMMAND_NOT_FOUND', `Command '${commandPath.join(' ')}' not found`)
  }

  if (!commandDef.handler) {
    if (commandDef.subcommands) {
      return error('VALIDATION_ERROR', `'${commandPath.join(' ')}' requires a subcommand`, {
        hint: `Run 'help ${commandPath.join(' ')}' for available subcommands`,
      })
    }
    return error('EXECUTION_ERROR', `Command '${commandPath.join(' ')}' has no handler`)
  }

  const argsResult = parseArgs(argTokens, commandDef.args || {})
  if (!argsResult.ok) {
    return argsResult.error
  }

  try {
    const result = await commandDef.handler(argsResult.value)
    const duration = Date.now() - startTime

    return {
      success: true,
      data: result,
      _meta: {
        command: command,
        duration_ms: duration,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return error('EXECUTION_ERROR', `Command failed: ${message}`)
  }
}

/**
 * CLI options
 */
export interface CliOptions {
  commands: CommandRegistry
  args?: string[]
}

/**
 * Run CLI with given commands and arguments
 *
 * @example
 * ```typescript
 * import { runCli, defineCommands } from '@lifeprompt/acli';
 *
 * const commands = defineCommands({
 *   greet: {
 *     description: 'Say hello',
 *     args: { name: { type: 'string', required: true } },
 *     handler: async ({ name }) => ({ message: `Hello, ${name}!` })
 *   }
 * });
 *
 * runCli({ commands });
 * ```
 */
export async function runCli(options: CliOptions): Promise<void> {
  const { commands, args = process.argv.slice(2) } = options

  // Handle --version flag
  if (args.includes('--version') || args.includes('-v')) {
    const result = await handleVersion()
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }

  // Handle --help flag or empty args
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    const result = await handleHelp(commands, [])
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }

  // Execute command
  const command = args.join(' ')
  const result = await executeCommand(command, commands)

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}

/**
 * @deprecated Use runCli({ commands }) instead
 */
export function setCommands(_commands: CommandRegistry): void {
  console.warn('setCommands is deprecated. Use runCli({ commands }) instead.')
}
