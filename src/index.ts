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
  ArgMeta,
  ArgSchema,
  ArgsDefinition,
  CommandDefinition,
  CommandRegistry,
  InferArgs,
} from './router/registry'
export { arg, cmd, csvArg, defineCommand } from './router/registry'
