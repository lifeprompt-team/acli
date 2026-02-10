/**
 * acli REPL — Interactive command shell
 *
 * Load commands from a JS/TS file and execute them interactively.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { executeCommand } from './executor'
import type { CommandDefinition, CommandRegistry } from './router/registry'
import { listCommands } from './router/registry'

// Version (injected at build time)
declare const __VERSION__: string | undefined
const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'

// ============================================================================
// ANSI Colors (zero dependencies)
// ============================================================================

const useColor = process.env.NO_COLOR == null && process.stdout.isTTY
const dim = (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s)
const bold = (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s)
const cyan = (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s)
const red = (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s)

// ============================================================================
// Module Loader
// ============================================================================

/**
 * Dynamically import a module (JS or TS).
 *
 * For .ts files, tries jiti if native import fails.
 */
async function importModule(filePath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(process.cwd(), filePath)

  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`)
  }

  const isTypeScript = /\.tsx?$/.test(filePath)
  const fileUrl = pathToFileURL(absolutePath).href

  // Try native import first (works for .js/.mjs, and TS-capable runtimes like Bun/Deno/Node 22.6+)
  try {
    return await import(fileUrl)
  } catch (nativeError) {
    if (!isTypeScript) throw nativeError

    // Fallback: try jiti for TypeScript files
    try {
      const jitiMod = await import('jiti')
      const createJiti = jitiMod.createJiti || jitiMod.default?.createJiti || jitiMod.default
      if (typeof createJiti === 'function') {
        const jiti = createJiti(import.meta.url, { interopDefault: true })
        return (await jiti.import(absolutePath)) as Record<string, unknown>
      }
    } catch {
      // jiti not available — fall through to helpful error
    }

    throw new Error(
      `Cannot load TypeScript file: ${filePath}\n\n` +
        `To load .ts files, use one of:\n` +
        `  1. Install jiti:   npm install -D jiti\n` +
        `  2. Use Bun:        bunx @lifeprompt/acli repl ${filePath}\n` +
        `  3. Compile to JS:  npx tsup ${filePath} --format esm\n`,
    )
  }
}

/**
 * Check if a value looks like a CommandDefinition
 */
function isCommandDefinition(value: unknown): value is CommandDefinition {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.description === 'string' &&
    (typeof obj.handler === 'function' ||
      (obj.subcommands != null && typeof obj.subcommands === 'object'))
  )
}

/**
 * Check if an object is a CommandRegistry (all values are CommandDefinition)
 */
function isCommandRegistry(obj: Record<string, unknown>): obj is CommandRegistry {
  const entries = Object.entries(obj)
  return entries.length > 0 && entries.every(([, v]) => isCommandDefinition(v))
}

/**
 * Extract CommandRegistry from module exports.
 *
 * Supports three patterns:
 *   1. `export default { cmd1, cmd2 }`
 *   2. `export const commands = { cmd1, cmd2 }`
 *   3. `export const cmd1 = defineCommand({...})` (individual named exports)
 */
function extractRegistry(mod: Record<string, unknown>, filePath: string): CommandRegistry {
  // Pattern 1: default export
  if (mod.default && typeof mod.default === 'object') {
    if (isCommandRegistry(mod.default as Record<string, unknown>)) {
      return mod.default as CommandRegistry
    }
  }

  // Pattern 2: named 'commands' export
  if (
    mod.commands &&
    typeof mod.commands === 'object' &&
    isCommandRegistry(mod.commands as Record<string, unknown>)
  ) {
    return mod.commands as CommandRegistry
  }

  // Pattern 3: collect individual named exports
  const registry: CommandRegistry = {}
  for (const [key, value] of Object.entries(mod)) {
    if (key === 'default' || key === '__esModule') continue
    if (isCommandDefinition(value)) {
      registry[key] = value
    }
  }

  if (Object.keys(registry).length === 0) {
    throw new Error(
      `No commands found in: ${filePath}\n\n` +
        `Export commands in one of these formats:\n` +
        `  export default { cmd1, cmd2 }            // default export\n` +
        `  export const commands = { cmd1, cmd2 }    // named 'commands'\n` +
        `  export const cmd1 = defineCommand({...})  // individual exports\n`,
    )
  }

  return registry
}

/**
 * Load commands from a JS/TS file
 */
export async function loadCommands(filePath: string): Promise<CommandRegistry> {
  const mod = await importModule(filePath)
  return extractRegistry(mod, filePath)
}

// ============================================================================
// REPL
// ============================================================================

export interface ReplOptions {
  /** Path to JS/TS file exporting commands */
  file: string
  /** Custom prompt string (default: "acli> ") */
  prompt?: string
}

/**
 * Start interactive REPL session
 *
 * @example
 * ```typescript
 * import { startRepl } from '@lifeprompt/acli/repl'
 * await startRepl({ file: './tools.ts' })
 * ```
 */
export async function startRepl(options: ReplOptions): Promise<void> {
  const { file, prompt: customPrompt } = options

  // Load commands
  let commands: CommandRegistry
  try {
    commands = await loadCommands(file)
  } catch (err) {
    console.error(red(err instanceof Error ? err.message : String(err)))
    process.exit(1)
  }

  const commandList = listCommands(commands)
  const topLevelNames = Object.keys(commands)

  // Welcome message
  console.log('')
  console.log(`  ${bold('acli')} ${dim(`v${VERSION}`)} ${dim('— Interactive REPL')}`)
  console.log(`  ${dim(`Loaded ${commandList.length} command(s) from ${file}`)}`)
  console.log(`  ${dim("Type 'help' for commands, '.exit' to quit")}`)
  console.log('')

  // Tab completion
  const completer = (line: string): [string[], string] => {
    const builtins = ['help', 'schema', 'version', '.exit', '.clear']
    const allNames = [...topLevelNames, ...builtins]
    const trimmed = line.trim()
    const hits = allNames.filter((c) => c.startsWith(trimmed))
    return [hits.length ? hits : allNames, trimmed]
  }

  const promptStr = customPrompt || `${cyan('acli')}${dim('>')} `

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptStr,
    completer,
    terminal: process.stdin.isTTY ?? false,
  })

  // Process lines sequentially (important for piped input where lines arrive all at once)
  const queue: string[] = []
  let processing = false
  let exiting = false

  async function processQueue(): Promise<void> {
    if (processing) return
    processing = true

    while (queue.length > 0 && !exiting) {
      const line = queue.shift()!
      await processLine(line)
    }

    processing = false
    if (!exiting) rl.prompt()
  }

  async function processLine(line: string): Promise<void> {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) return

    // REPL meta-commands
    if (trimmed === '.exit' || trimmed === 'exit') {
      console.log(dim('Bye!'))
      exiting = true
      rl.close()
      return
    }

    if (trimmed === '.clear') {
      console.clear()
      return
    }

    // Execute ACLI command
    try {
      const { result, isError } = await executeCommand(trimmed, commands)
      const output = JSON.stringify(result, null, 2)
      console.log(isError ? red(output) : output)
    } catch (err) {
      console.error(red(err instanceof Error ? err.message : String(err)))
    }
  }

  rl.on('line', (line: string) => {
    queue.push(line)
    processQueue()
  })

  rl.on('close', () => {
    process.exit(0)
  })

  rl.prompt()
}

// ============================================================================
// Single Command Execution
// ============================================================================

export interface ExecOptions {
  /** Path to JS/TS file exporting commands */
  file: string
  /** Command string to execute */
  command: string
}

/**
 * Execute a single command from a file and exit
 *
 * @example
 * ```typescript
 * import { execFromFile } from '@lifeprompt/acli/repl'
 * await execFromFile({ file: './tools.ts', command: 'add 1 2' })
 * ```
 */
export async function execFromFile(options: ExecOptions): Promise<void> {
  const { file, command } = options

  let commands: CommandRegistry
  try {
    commands = await loadCommands(file)
  } catch (err) {
    console.error(red(err instanceof Error ? err.message : String(err)))
    process.exit(1)
  }

  const { result, isError } = await executeCommand(command, commands)
  console.log(JSON.stringify(result, null, 2))
  process.exit(isError ? 1 : 0)
}
