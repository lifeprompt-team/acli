// acli - Agent CLI
// Lightweight CLI protocol for AI agents on MCP

export { createAcli } from './mcp/tool'
export { defineCommands } from './router/registry'

// Types
export type {
  AcliSuccessResponse,
  AcliErrorResponse,
  AcliResponse,
  AcliErrorCode,
} from './response/types'

export type {
  CommandDefinition,
  ArgumentDefinition,
  ArgumentType,
  ParsedArgs,
} from './router/registry'

// Version
export const VERSION = '0.1.0'
