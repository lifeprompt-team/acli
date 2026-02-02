// acli - Agent CLI
// Lightweight CLI protocol for AI agents on MCP

export { type CliOptions, runCli, setCommands } from './cli'
export { type AcliToolOptions, createAcli, registerAcli } from './mcp/tool'
// Types
export type {
  AcliErrorCode,
  AcliErrorResponse,
  AcliResponse,
  AcliSuccessResponse,
} from './response/types'
export type {
  ArgumentDefinition,
  ArgumentType,
  CommandDefinition,
  ParsedArgs,
} from './router/registry'
export { defineCommands } from './router/registry'

// Version
export const VERSION = '0.4.2'
