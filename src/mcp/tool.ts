/**
 * MCP Tool integration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { handleHelp, handleSchema, handleVersion } from '../discovery'
import { parseArgs } from '../parser/args'
import { tokenize } from '../parser/tokenizer'
import { type AcliResponse, error } from '../response/types'
import {
  type CommandRegistry,
  extractCommandPath,
  findCommand,
  listCommands,
} from '../router/registry'

/**
 * Execute CLI command and return response
 */
async function executeCommand(command: string, commands: CommandRegistry): Promise<AcliResponse> {
  const startTime = Date.now()

  // Tokenize
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
      examples: listCommands(commands)
        .slice(0, 3)
        .map((c) => c.name),
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
 * Register acli tool with MCP Server
 *
 * @example
 * ```typescript
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAcli, defineCommands } from "@lifeprompt/acli";
 *
 * const commands = defineCommands({
 *   calendar: {
 *     description: "Manage calendar",
 *     subcommands: {
 *       events: {
 *         description: "List events",
 *         handler: async () => ({ events: [] })
 *       }
 *     }
 *   }
 * });
 *
 * const server = new McpServer({ name: "my-server", version: "1.0.0" });
 * registerAcli(server, commands);
 * ```
 */
export function registerAcli(mcp: McpServer, commands: CommandRegistry, toolName = 'cli'): void {
  mcp.registerTool(
    toolName,
    {
      description: `Execute CLI command. Run 'help' for available commands.`,
      inputSchema: {
        command: z.string().describe("CLI command string (e.g., 'calendar events --today')"),
      },
    },
    async (params: { command: string }) => {
      const result = await executeCommand(params.command, commands)

      // MCP expects { content: [...] } format
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    },
  )
}

// ============================================================
// Legacy API (for standalone use without MCP SDK)
// ============================================================

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
 * Create a standalone acli tool definition (legacy API)
 *
 * @deprecated Use `registerAcli(mcp, commands)` for MCP SDK integration
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
    execute: (input) => executeCommand(input.command, commands),
  }
}
