// acli - Agent CLI
// Lightweight CLI protocol for AI agents on MCP

// Version is injected at build time from package.json
// Falls back to reading package.json directly during development/testing
declare const __VERSION__: string | undefined
export const VERSION: string =
  typeof __VERSION__ !== 'undefined'
    ? __VERSION__
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('../package.json') as { version: string }).version

export { runCli, type CliOptions } from './cli'
export { executeCommand, type ExecuteResult } from './executor'
export {
  createAcli,
  registerAcli,
  type AcliError,
  type AcliToolOptions,
  type CallToolResult,
  type ImageContent,
  type TextContent,
} from './mcp/tool'
export { error, type AcliErrorCode } from './response'
export { arg, defineCommands } from './router/registry'
export type {
  ArgMeta,
  ArgSchema,
  ArgsDefinition,
  CommandDefinition,
  CommandRegistry,
  InferArgs,
} from './router/registry'
