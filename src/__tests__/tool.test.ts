import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type CallToolResult, type TextContent, createAcli } from '../mcp/tool'
import { arg, defineCommands } from '../router/registry'

/**
 * Helper to extract JSON from MCP response
 */
function extractJson(response: CallToolResult): unknown {
  const textContent = response.content.find(
    (c: { type: string }): c is TextContent => c.type === 'text',
  )
  if (!textContent) {
    throw new Error('No text content found')
  }
  return JSON.parse(textContent.text)
}

describe('MCP tool', () => {
  const commands = defineCommands({
    echo: {
      description: 'Echo back input',
      args: {
        message: arg(z.string()),
      },
      handler: async ({ message }) => ({ echoed: message }),
    },
    greet: {
      description: 'Greet someone',
      subcommands: {
        hello: {
          description: 'Say hello',
          args: {
            name: arg(z.string().default('World')),
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
    native: {
      description: 'Returns MCP native format',
      handler: async () => ({
        content: [
          { type: 'text' as const, text: 'Hello from native' },
          { type: 'text' as const, text: 'Second content' },
        ],
      }),
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
    it('executes simple command and returns MCP format', async () => {
      const result = await tool.execute({ command: 'echo --message hello' })
      expect(result.content).toBeDefined()
      expect(result.isError).toBeFalsy()

      const data = extractJson(result)
      expect(data).toEqual({ echoed: 'hello' })
    })

    it('executes nested command', async () => {
      const result = await tool.execute({ command: 'greet hello --name Alice' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result)
      expect(data).toEqual({ greeting: 'Hello, Alice!' })
    })

    it('uses default values', async () => {
      const result = await tool.execute({ command: 'greet hello' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result)
      expect(data).toEqual({ greeting: 'Hello, World!' })
    })

    it('passes through MCP native format', async () => {
      const result = await tool.execute({ command: 'native' })
      expect(result.content).toHaveLength(2)
      expect(result.content[0]).toEqual({ type: 'text', text: 'Hello from native' })
      expect(result.content[1]).toEqual({ type: 'text', text: 'Second content' })
    })
  })

  describe('error handling', () => {
    it('returns error for empty command', async () => {
      const result = await tool.execute({ command: '' })
      expect(result.isError).toBe(true)

      const data = extractJson(result) as { error: { code: string } }
      expect(data.error.code).toBe('PARSE_ERROR')
    })

    it('returns error for unknown command', async () => {
      const result = await tool.execute({ command: 'unknown' })
      expect(result.isError).toBe(true)

      const data = extractJson(result) as { error: { code: string } }
      expect(data.error.code).toBe('COMMAND_NOT_FOUND')
    })

    it('returns error for missing required arg', async () => {
      const result = await tool.execute({ command: 'echo' })
      expect(result.isError).toBe(true)

      const data = extractJson(result) as { error: { code: string } }
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('catches handler errors', async () => {
      const result = await tool.execute({ command: 'fail' })
      expect(result.isError).toBe(true)

      const data = extractJson(result) as { error: { code: string; message: string } }
      expect(data.error.code).toBe('EXECUTION_ERROR')
      expect(data.error.message).toContain('Intentional failure')
    })

    it('treats shell metacharacters as plain text', async () => {
      const result = await tool.execute({ command: 'echo --message "test; rm -rf /"' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result)
      expect(data).toEqual({ echoed: 'test; rm -rf /' })
    })
  })

  describe('discovery commands', () => {
    it('handles help command', async () => {
      const result = await tool.execute({ command: 'help' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result) as Record<string, unknown>
      expect(data).toHaveProperty('commands')
    })

    it('handles help for specific command', async () => {
      const result = await tool.execute({ command: 'help echo' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result) as Record<string, unknown>
      expect(data).toHaveProperty('command', 'echo')
      expect(data).toHaveProperty('arguments')
    })

    it('handles version command', async () => {
      const result = await tool.execute({ command: 'version' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result) as Record<string, unknown>
      expect(data).toHaveProperty('acli_version')
    })

    it('handles schema command', async () => {
      const result = await tool.execute({ command: 'schema' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result) as Record<string, unknown>
      expect(data).toHaveProperty('commands')
    })

    it('handles schema for specific command', async () => {
      const result = await tool.execute({ command: 'schema echo' })
      expect(result.isError).toBeFalsy()

      const data = extractJson(result) as Record<string, unknown>
      expect(data).toHaveProperty('inputSchema')
    })
  })
})
