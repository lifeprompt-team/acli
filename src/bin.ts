/**
 * acli CLI entry point
 *
 * Usage:
 *   acli repl <file>             Start interactive REPL
 *   acli exec <file> <command>   Execute single command
 *   acli --version               Show version
 *   acli --help                  Show help
 */

// Version (injected at build time)
declare const __VERSION__: string | undefined
const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'

// ANSI helpers
const useColor = process.env.NO_COLOR == null && process.stdout.isTTY
const bold = (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s)
const dim = (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s)

const args = process.argv.slice(2)

async function main(): Promise<void> {
  const subcommand = args[0]

  // No args or help flag
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    showHelp()
    return
  }

  // Version flag
  if (subcommand === '--version' || subcommand === '-v') {
    console.log(`acli v${VERSION}`)
    return
  }

  // ── repl ──────────────────────────────────────────────────────────
  if (subcommand === 'repl') {
    const file = args[1]
    if (!file || file.startsWith('-')) {
      console.error('Usage: acli repl <file>\n')
      console.error('  <file>  Path to JS/TS file exporting ACLI commands')
      console.error('')
      console.error('Example:')
      console.error('  acli repl ./tools.ts')
      process.exit(1)
    }
    const { startRepl } = await import('./repl')
    await startRepl({ file })
    process.exit(0)
  }

  // ── exec ──────────────────────────────────────────────────────────
  if (subcommand === 'exec') {
    const file = args[1]
    const command = args.slice(2).join(' ')
    if (!file || !command) {
      console.error('Usage: acli exec <file> <command...>\n')
      console.error('  <file>     Path to JS/TS file exporting ACLI commands')
      console.error('  <command>  Command string to execute')
      console.error('')
      console.error('Example:')
      console.error('  acli exec ./tools.ts "add 1 2"')
      process.exit(1)
    }
    const { execFromFile } = await import('./repl')
    const { result, isError } = await execFromFile({ file, command })
    console.log(JSON.stringify(result, null, 2))
    process.exit(isError ? 1 : 0)
  }

  // ── unknown ───────────────────────────────────────────────────────
  console.error(`Unknown command: ${subcommand}`)
  console.error("Run 'acli --help' for usage\n")
  process.exit(1)
}

function showHelp(): void {
  console.log(`
  ${bold('acli')} v${VERSION} — Agent CLI

  ${dim('Usage:')}
    acli repl <file>              Start interactive REPL
    acli exec <file> <command>    Execute a single command
    acli --version                Show version
    acli --help                   Show this help

  ${dim('Examples:')}
    acli repl ./tools.ts          Start REPL with commands from tools.ts
    acli exec ./tools.ts "add 1 2"  Run 'add 1 2' and exit

  ${dim('File format:')}
    The file should export ACLI commands:

      import { defineCommand, arg } from '@lifeprompt/acli'
      import { z } from 'zod'

      export const add = defineCommand({
        description: 'Add two numbers',
        args: {
          a: arg(z.number(), { positional: 0 }),
          b: arg(z.number(), { positional: 1 }),
        },
        handler: async ({ a, b }) => ({ result: a + b }),
      })

  ${dim('TypeScript support:')}
    Install jiti for .ts file support: npm install -D jiti
    Or use Bun/Deno which support TypeScript natively.
`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
