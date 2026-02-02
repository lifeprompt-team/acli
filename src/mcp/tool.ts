/**
 * MCP Tool integration
 */

import { tokenize } from '../parser/tokenizer'
import { error, type AcliResponse } from '../response/types'
import {
    type CommandRegistry,
    extractCommandPath,
    findCommand,
    listCommands,
} from '../router/registry'
import { handleHelp, handleSchema, handleVersion } from '../discovery'
import { parseArgs } from '../parser/args'

export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: {
      command: {
        type: 'string'
        description: string
      }
    }
    required: string[]
  }
  execute: (input: { command: string }) => Promise<AcliResponse>
}

/**
 * Create an acli MCP tool from command definitions
 */
export function createAcli(commands: CommandRegistry): MCPToolDefinition {
  return {
    name: 'cli',
    description: "Execute CLI command. Run 'help' for available commands.",
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: "CLI command string (e.g., 'calendar events --today')",
        },
      },
      required: ['command'],
    },
    execute: async (input) => {
      const startTime = Date.now()

      // Tokenize
      const tokenResult = tokenize(input.command)
      if (!tokenResult.ok) {
        return tokenResult.error
      }

      const tokens = tokenResult.value
      if (tokens.length === 0) {
        return error('PARSE_ERROR', 'Empty command', {
          hint: "Run 'help' for available commands",
        })
      }

      // Handle built-in commands
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

      // Extract command path
      const [commandPath, argTokens] = extractCommandPath(commands, tokens)
      if (commandPath.length === 0) {
        return error('COMMAND_NOT_FOUND', `Command '${firstToken}' not found`, {
          hint: "Run 'help' for available commands",
          examples: listCommands(commands).slice(0, 3).map((c) => c.name),
        })
      }

      // Find command definition
      const commandDef = findCommand(commands, commandPath)
      if (!commandDef) {
        return error('COMMAND_NOT_FOUND', `Command '${commandPath.join(' ')}' not found`)
      }

      // Check if command has handler
      if (!commandDef.handler) {
        if (commandDef.subcommands) {
          return error('VALIDATION_ERROR', `'${commandPath.join(' ')}' requires a subcommand`, {
            hint: `Run 'help ${commandPath.join(' ')}' for available subcommands`,
          })
        }
        return error('EXECUTION_ERROR', `Command '${commandPath.join(' ')}' has no handler`)
      }

      // Parse arguments
      const argsResult = parseArgs(argTokens, commandDef.args || {})
      if (!argsResult.ok) {
        return argsResult.error
      }

      // Execute handler
      try {
        const result = await commandDef.handler(argsResult.value)
        const duration = Date.now() - startTime

        return {
          success: true,
          data: result,
          _meta: {
            command: input.command,
            duration_ms: duration,
          },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return error('EXECUTION_ERROR', `Command failed: ${message}`)
      }
    },
  }
}
