import { describe, expect, it } from 'vitest'
import { createAcli } from '../mcp/tool'
import { defineCommands } from '../router/registry'

describe('MCP tool', () => {
  const commands = defineCommands({
    echo: {
      description: 'Echo back input',
      args: {
        message: { type: 'string', required: true },
      },
      handler: async ({ message }) => ({ echoed: message }),
    },
    greet: {
      description: 'Greet someone',
      subcommands: {
        hello: {
          description: 'Say hello',
          args: {
            name: { type: 'string', default: 'World' },
          },
          handler: async ({ name }) => ({ greeting: `Hello, ${name}!` }),
        },
      },
    },
    fail: {
      description: 'Always fails',
      handler: async () => {
        throw new Error('Intentional failure')
      },
    },
  })

  const tool = createAcli(commands)

  describe('tool definition', () => {
    it('has correct name', () => {
      expect(tool.name).toBe('cli')
    })

    it('has input schema', () => {
      expect(tool.inputSchema.properties.command).toBeDefined()
    })
  })

  describe('command execution', () => {
    it('executes simple command', async () => {
      const result = await tool.execute({ command: 'echo --message hello' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ echoed: 'hello' })
      }
    })

    it('executes nested command', async () => {
      const result = await tool.execute({ command: 'greet hello --name Alice' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ greeting: 'Hello, Alice!' })
      }
    })

    it('uses default values', async () => {
      const result = await tool.execute({ command: 'greet hello' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ greeting: 'Hello, World!' })
      }
    })
  })

  describe('error handling', () => {
    it('returns error for empty command', async () => {
      const result = await tool.execute({ command: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('PARSE_ERROR')
      }
    })

    it('returns error for unknown command', async () => {
      const result = await tool.execute({ command: 'unknown' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('COMMAND_NOT_FOUND')
      }
    })

    it('returns error for missing required arg', async () => {
      const result = await tool.execute({ command: 'echo' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('catches handler errors', async () => {
      const result = await tool.execute({ command: 'fail' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('EXECUTION_ERROR')
        expect(result.error.message).toContain('Intentional failure')
      }
    })

    it('blocks injection attempts', async () => {
      const result = await tool.execute({ command: 'echo --message "test; rm -rf /"' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INJECTION_BLOCKED')
      }
    })
  })

  describe('discovery commands', () => {
    it('handles help command', async () => {
      const result = await tool.execute({ command: 'help' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('commands')
      }
    })

    it('handles help for specific command', async () => {
      const result = await tool.execute({ command: 'help echo' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('command', 'echo')
        expect(result.data).toHaveProperty('arguments')
      }
    })

    it('handles version command', async () => {
      const result = await tool.execute({ command: 'version' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('acli_version')
      }
    })

    it('handles schema command', async () => {
      const result = await tool.execute({ command: 'schema' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('commands')
      }
    })

    it('handles schema for specific command', async () => {
      const result = await tool.execute({ command: 'schema echo' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('inputSchema')
      }
    })
  })
})
