/**
 * Command executor - shared logic for MCP and CLI
 */

import { handleHelp, handleSchema, handleVersion } from '../discovery'
import { parseArgs } from '../parser/args'
import { tokenize } from '../parser/tokenizer'
import { error } from '../response'
import {
  type CommandRegistry,
  extractCommandPath,
  findCommand,
  listCommands,
} from '../router/registry'

/**
 * Execute result
 */
export interface ExecuteResult {
  result: unknown
  isError: boolean
}

/**
 * Execute CLI command and return handler result or error
 */
export async function executeCommand(
  command: string,
  commands: CommandRegistry,
): Promise<ExecuteResult> {
  // Tokenize
  const tokenResult = tokenize(command)
  if (!tokenResult.ok) {
    return { result: tokenResult.error, isError: true }
  }

  const tokens = tokenResult.value
  if (tokens.length === 0) {
    return {
      result: error('PARSE_ERROR', 'Empty command', {
        hint: "Run 'help' for available commands",
      }),
      isError: true,
    }
  }

  // Handle built-in commands
  const firstToken = tokens[0]
  if (firstToken === 'help') {
    return { result: handleHelp(commands, tokens.slice(1)), isError: false }
  }
  if (firstToken === 'schema') {
    return { result: handleSchema(commands, tokens.slice(1)), isError: false }
  }
  if (firstToken === 'version') {
    return { result: handleVersion(), isError: false }
  }

  // Check for --help or -h flag
  const helpFlagIndex = tokens.findIndex((t) => t === '--help' || t === '-h')
  if (helpFlagIndex !== -1) {
    // Tokens before --help are the command path for help
    const helpPath = tokens.slice(0, helpFlagIndex)
    return { result: handleHelp(commands, helpPath), isError: false }
  }

  // Check for --version or -v flag
  if (tokens.includes('--version') || tokens.includes('-v')) {
    return { result: handleVersion(), isError: false }
  }

  // Extract command path
  const [commandPath, argTokens] = extractCommandPath(commands, tokens)
  if (commandPath.length === 0) {
    return {
      result: error('COMMAND_NOT_FOUND', `Command '${firstToken}' not found`, {
        hint: "Run 'help' for available commands",
        examples: listCommands(commands)
          .slice(0, 3)
          .map((c) => c.name),
      }),
      isError: true,
    }
  }

  // Find command definition
  const commandDef = findCommand(commands, commandPath)
  if (!commandDef) {
    return {
      result: error('COMMAND_NOT_FOUND', `Command '${commandPath.join(' ')}' not found`),
      isError: true,
    }
  }

  // Check if command has handler
  if (!commandDef.handler) {
    if (commandDef.subcommands) {
      return {
        result: error('VALIDATION_ERROR', `'${commandPath.join(' ')}' requires a subcommand`, {
          hint: `Run 'help ${commandPath.join(' ')}' for available subcommands`,
        }),
        isError: true,
      }
    }
    return {
      result: error('EXECUTION_ERROR', `Command '${commandPath.join(' ')}' has no handler`),
      isError: true,
    }
  }

  // Parse arguments
  const argsResult = parseArgs(argTokens, commandDef.args || {})
  if (!argsResult.ok) {
    return { result: argsResult.error, isError: true }
  }

  // Execute handler
  try {
    const result = await commandDef.handler(argsResult.value)
    return { result, isError: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      result: error('EXECUTION_ERROR', `Command failed: ${message}`),
      isError: true,
    }
  }
}
