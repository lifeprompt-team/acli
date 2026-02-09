/**
 * MCP Tool integration
 *
 * Handler return values are converted to MCP response format:
 * - If handler returns { content: [...] }, it's passed through as-is (MCP native)
 * - Otherwise, the return value is wrapped in { content: [{ type: "text", text: JSON.stringify(value) }] }
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { executeCommand } from '../executor'
import type { AcliError } from '../response'
import type { CommandRegistry } from '../router/registry'

/**
 * Re-export types for convenience
 */
export type { AcliError, CallToolResult, ImageContent, TextContent }

/**
 * Check if a value is already in MCP response format
 */
function isMcpResponse(value: unknown): value is CallToolResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'content' in value &&
    Array.isArray((value as CallToolResult).content)
  )
}

/**
 * Convert any value to MCP response format
 */
function toMcpResponse(value: unknown, isError = false): CallToolResult {
  if (isMcpResponse(value)) {
    return value
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
    ...(isError && { isError: true }),
  }
}

/**
 * Options for registerAcli
 */
export interface AcliToolOptions {
  /** Tool name (default: 'cli') */
  name: string
  /** Base description (optional, will be enhanced with command list) */
  description?: string
}

/**
 * Generate tool description from commands
 */
function generateDescription(commands: CommandRegistry, baseDescription?: string): string {
  const commandNames = Object.keys(commands)
  const commandList = commandNames.join(', ')

  if (baseDescription) {
    return `${baseDescription} Commands: ${commandList}. Run 'help' for details.`
  }
  return `Commands: ${commandList}. Run 'help' for details.`
}

/**
 * Register acli tool with MCP Server
 *
 * Handler return values are automatically converted to MCP format:
 * - { content: [...] } → passed through as-is
 * - Any other value → wrapped in { content: [{ type: "text", text: JSON.stringify(value) }] }
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerAcli, defineCommand, arg } from "@lifeprompt/acli";
 *
 * const simple = defineCommand({
 *   description: "Returns simple object",
 *   args: { n: arg(z.coerce.number()) },
 *   handler: async ({ n }) => ({ result: n * 2 }),
 *   // → { content: [{ type: "text", text: '{"result":246}' }] }
 * });
 *
 * const native = defineCommand({
 *   description: "Returns MCP native format",
 *   args: {},
 *   handler: async () => ({
 *     content: [
 *       { type: "text", text: "Hello" },
 *       { type: "image", data: "base64...", mimeType: "image/png" },
 *     ]
 *   }),
 *   // → passed through as-is
 * });
 *
 * const server = new McpServer({ name: "my-server", version: "1.0.0" });
 * registerAcli(server, { simple, native }, { name: "my_tool", description: "My tool." });
 * ```
 */
export function registerAcli(
  mcp: McpServer,
  commands: CommandRegistry,
  options: string | AcliToolOptions = 'cli',
): void {
  const opts: AcliToolOptions = typeof options === 'string' ? { name: options } : options

  const toolName = opts.name
  const description = generateDescription(commands, opts.description)

  mcp.registerTool(
    toolName,
    {
      description,
      inputSchema: {
        command: z
          .string()
          .describe(`CLI command (e.g., '${Object.keys(commands)[0] ?? 'help'} --help')`),
      },
    },
    async (params: { command: string }): Promise<CallToolResult> => {
      const { result, isError } = await executeCommand(params.command, commands)
      return toMcpResponse(result, isError)
    },
  )
}

// ============================================================
// Legacy API (for standalone use without MCP SDK)
// ============================================================

/**
 * Legacy tool definition type
 * @deprecated Use registerAcli with MCP SDK instead
 */
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
  execute: (input: { command: string }) => Promise<CallToolResult>
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
    execute: async (input): Promise<CallToolResult> => {
      const { result, isError } = await executeCommand(input.command, commands)
      return toMcpResponse(result, isError)
    },
  }
}
