// acli - Agent CLI
// Lightweight CLI protocol for AI agents on MCP

// Version (single source of truth)
export const VERSION = '0.5.0'

export { type CliOptions, runCli } from './cli'
export { type ExecuteResult, executeCommand } from './executor'
export {
  type AcliError,
  type AcliToolOptions,
  type CallToolResult,
  createAcli,
  type ImageContent,
  registerAcli,
  type TextContent,
} from './mcp/tool'
export { type AcliErrorCode, error } from './response'
export type {
  ArgumentDefinition,
  ArgumentType,
  CommandDefinition,
  ParsedArgs,
} from './router/registry'
export { defineCommands } from './router/registry'
