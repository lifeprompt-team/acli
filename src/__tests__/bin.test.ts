import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const BIN = resolve(__dirname, '../../dist/bin.js')
const FIXTURE = resolve(__dirname, 'fixtures/commands-named-exports.mjs')
const NO_COMMANDS = resolve(__dirname, 'fixtures/no-commands.mjs')

/**
 * Run the CLI binary and capture output + exit code.
 */
function run(args: string[], input?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = execFile('node', [BIN, ...args], { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        code: error?.code != null ? (error.code as unknown as number) : child.exitCode ?? 0,
      })
    })
    if (input != null) {
      child.stdin?.write(input)
      child.stdin?.end()
    }
  })
}

// ============================================================================
// CLI Entry Point
// ============================================================================

describe('CLI: acli', () => {
  describe('--help', () => {
    it('shows help and exits 0', async () => {
      const { stdout, code } = await run(['--help'])
      expect(code).toBe(0)
      expect(stdout).toContain('acli')
      expect(stdout).toContain('repl')
      expect(stdout).toContain('exec')
    })

    it('shows help with -h alias', async () => {
      const { stdout, code } = await run(['-h'])
      expect(code).toBe(0)
      expect(stdout).toContain('acli')
    })

    it('shows help when no args provided', async () => {
      const { stdout, code } = await run([])
      expect(code).toBe(0)
      expect(stdout).toContain('acli')
    })
  })

  describe('--version', () => {
    it('shows version and exits 0', async () => {
      const { stdout, code } = await run(['--version'])
      expect(code).toBe(0)
      expect(stdout).toMatch(/^acli v\d+\.\d+\.\d+/)
    })

    it('shows version with -v alias', async () => {
      const { stdout, code } = await run(['-v'])
      expect(code).toBe(0)
      expect(stdout).toMatch(/^acli v\d+\.\d+\.\d+/)
    })
  })

  describe('unknown command', () => {
    it('exits 1 with error message', async () => {
      const { stderr, code } = await run(['doesnotexist'])
      expect(code).toBe(1)
      expect(stderr).toContain('Unknown command')
    })
  })
})

// ============================================================================
// exec subcommand
// ============================================================================

describe('CLI: acli exec', () => {
  it('executes a command and returns JSON result', async () => {
    const { stdout, code } = await run(['exec', FIXTURE, 'add'])
    expect(code).toBe(0)
    const result = JSON.parse(stdout)
    expect(result).toEqual({ result: 3 })
  })

  it('executes help command via exec', async () => {
    const { stdout, code } = await run(['exec', FIXTURE, 'help'])
    expect(code).toBe(0)
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('commands')
  })

  it('exits 1 for unknown command', async () => {
    const { stdout, code } = await run(['exec', FIXTURE, 'nonexistent'])
    expect(code).toBe(1)
    const result = JSON.parse(stdout)
    expect(result.error.code).toBe('COMMAND_NOT_FOUND')
  })

  it('exits 1 for non-existent file', async () => {
    const { stderr, code } = await run(['exec', '/nonexistent/file.mjs', 'add'])
    expect(code).toBe(1)
    expect(stderr).toContain('File not found')
  })

  it('exits 1 for file with no commands', async () => {
    const { stderr, code } = await run(['exec', NO_COMMANDS, 'add'])
    expect(code).toBe(1)
    expect(stderr).toContain('No commands found')
  })

  it('shows usage when file arg is missing', async () => {
    const { stderr, code } = await run(['exec'])
    expect(code).toBe(1)
    expect(stderr).toContain('Usage')
  })

  it('shows usage when command arg is missing', async () => {
    const { stderr, code } = await run(['exec', FIXTURE])
    expect(code).toBe(1)
    expect(stderr).toContain('Usage')
  })
})

// ============================================================================
// repl subcommand
// ============================================================================

describe('CLI: acli repl', () => {
  it('shows usage when file arg is missing', async () => {
    const { stderr, code } = await run(['repl'])
    expect(code).toBe(1)
    expect(stderr).toContain('Usage')
    expect(stderr).toContain('Example')
  })

  it('exits 1 for non-existent file', async () => {
    const { stderr, code } = await run(['repl', '/nonexistent/file.mjs'])
    expect(code).toBe(1)
    expect(stderr).toContain('File not found')
  })

  it('shows welcome message and processes piped commands', async () => {
    const input = 'help\nadd\nexit\n'
    const { stdout, code } = await run(['repl', FIXTURE], input)
    expect(code).toBe(0)
    // Welcome message
    expect(stdout).toContain('Interactive REPL')
    expect(stdout).toContain('Loaded')
    // help output
    expect(stdout).toContain('"commands"')
    // add command output
    expect(stdout).toContain('"result": 3')
    // exit
    expect(stdout).toContain('Bye!')
  })

  it('handles unknown command gracefully in REPL', async () => {
    const input = 'nonexistent\nexit\n'
    const { stdout, code } = await run(['repl', FIXTURE], input)
    expect(code).toBe(0)
    expect(stdout).toContain('COMMAND_NOT_FOUND')
    expect(stdout).toContain('Bye!')
  })

  it('skips empty lines in REPL', async () => {
    const input = '\n\nadd\n\nexit\n'
    const { stdout, code } = await run(['repl', FIXTURE], input)
    expect(code).toBe(0)
    expect(stdout).toContain('"result": 3')
  })
})
