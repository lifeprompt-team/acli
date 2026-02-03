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

import { handleHelp, handleVersion } from './discovery'
import { executeCommand } from './executor'
import type { CommandRegistry } from './router/registry'

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
    console.log(JSON.stringify(handleVersion(), null, 2))
    process.exit(0)
  }

  // Handle --help flag or empty args
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(JSON.stringify(handleHelp(commands, []), null, 2))
    process.exit(0)
  }

  // Execute command
  const command = args.join(' ')
  const { result, isError } = await executeCommand(command, commands)

  // Output result
  console.log(JSON.stringify(result, null, 2))
  process.exit(isError ? 1 : 0)
}
