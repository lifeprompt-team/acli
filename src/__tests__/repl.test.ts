import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCommands } from '../repl'

const fixturesDir = resolve(__dirname, 'fixtures')
const fixture = (name: string) => resolve(fixturesDir, name)

describe('loadCommands', () => {
  describe('export pattern detection', () => {
    it('detects individual named exports (pattern 3)', async () => {
      const commands = await loadCommands(fixture('commands-named-exports.mjs'))
      expect(Object.keys(commands)).toEqual(['add', 'greet'])
      expect(commands.add.description).toBe('Add two numbers')
      expect(commands.greet.description).toBe('Say hello')
    })

    it('detects default export as CommandRegistry (pattern 1)', async () => {
      const commands = await loadCommands(fixture('commands-default-export.mjs'))
      expect(Object.keys(commands)).toEqual(['add', 'multiply'])
      expect(commands.add.description).toBe('Add two numbers')
      expect(commands.multiply.description).toBe('Multiply two numbers')
    })

    it('detects named "commands" export (pattern 2)', async () => {
      const commands = await loadCommands(fixture('commands-named-registry.mjs'))
      expect(Object.keys(commands)).toEqual(['add', 'subtract'])
      expect(commands.add.description).toBe('Add two numbers')
      expect(commands.subtract.description).toBe('Subtract two numbers')
    })

    it('detects commands with subcommands (no handler)', async () => {
      const commands = await loadCommands(fixture('commands-with-subcommands.mjs'))
      expect(Object.keys(commands)).toEqual(['math'])
      expect(commands.math.description).toBe('Math operations')
      expect(commands.math.subcommands).toBeDefined()
      expect(commands.math.subcommands!.add.description).toBe('Add numbers')
    })

    it('filters out non-command exports', async () => {
      const commands = await loadCommands(fixture('mixed-exports.mjs'))
      // Should only pick up 'add' and 'greet', not 'API_VERSION' or 'helperFn'
      expect(Object.keys(commands)).toEqual(['add', 'greet'])
    })
  })

  describe('command execution from loaded modules', () => {
    it('executes handler from loaded commands', async () => {
      const commands = await loadCommands(fixture('commands-named-exports.mjs'))
      const result = await commands.add.handler!({} as never)
      expect(result).toEqual({ result: 3 })
    })

    it('executes subcommand handler from loaded commands', async () => {
      const commands = await loadCommands(fixture('commands-with-subcommands.mjs'))
      const result = await commands.math.subcommands!.add.handler!({} as never)
      expect(result).toEqual({ result: 3 })
    })
  })

  describe('error cases', () => {
    it('throws on non-existent file', async () => {
      await expect(loadCommands('/nonexistent/path/to/file.js')).rejects.toThrow('File not found')
    })

    it('throws with actionable hint on non-existent file', async () => {
      await expect(loadCommands('/nonexistent/path/to/file.js')).rejects.toThrow(
        'Check the path or run from the project root',
      )
    })

    it('throws when module has no commands', async () => {
      await expect(loadCommands(fixture('no-commands.mjs'))).rejects.toThrow('No commands found')
    })

    it('throws with export pattern hints when no commands found', async () => {
      await expect(loadCommands(fixture('no-commands.mjs'))).rejects.toThrow(
        'export default { cmd1, cmd2 }',
      )
    })
  })
})
