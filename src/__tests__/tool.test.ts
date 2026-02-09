import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type CallToolResult, createAcli, type TextContent } from '../mcp/tool'
import {
  aclify,
  arg,
  type CommandRegistry,
  defineCommand,
  type McpToolLike,
} from '../router/registry'

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
  // Use defineCommand for type inference
  const echo = defineCommand({
    description: 'Echo back input',
    args: {
      message: arg(z.string()),
    },
    handler: async ({ message }) => ({ echoed: message }),
  })

  const fail = defineCommand({
    description: 'Always fails',
    args: {},
    handler: async () => {
      throw new Error('Intentional failure')
    },
  })

  const native = defineCommand({
    description: 'Returns MCP native format',
    args: {},
    handler: async () => ({
      content: [
        { type: 'text' as const, text: 'Hello from native' },
        { type: 'text' as const, text: 'Second content' },
      ],
    }),
  })

  // Commands with subcommands use CommandRegistry type
  const commands: CommandRegistry = {
    echo,
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
    fail,
    native,
  }

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

describe('help output improvements', () => {
  const search = defineCommand({
    description: 'Search files in workspace',
    args: {
      query: arg(z.string(), { positional: 0, description: 'Search query' }),
      path: arg(z.string().optional(), { positional: 1, description: 'Directory path' }),
      verbose: arg(z.boolean().default(false), { short: 'v', description: 'Verbose output' }),
      limit: arg(z.coerce.number().default(20), { description: 'Max results' }),
      ext: arg(z.array(z.string()).optional(), { short: 'e', description: 'File extensions' }),
      color: arg(z.boolean().default(true), { description: 'Colorize output' }),
    },
    handler: async () => ({ results: [] }),
  })

  const commands: CommandRegistry = { search }
  const tool = createAcli(commands)

  it('displays positional args with <name> format', async () => {
    const result = await tool.execute({ command: 'help search' })
    const data = extractJson(result) as { arguments: Array<{ name: string; positional?: number }> }

    const queryArg = data.arguments.find((a) => a.positional === 0)
    expect(queryArg).toBeDefined()
    expect(queryArg!.name).toBe('<query>')

    const pathArg = data.arguments.find((a) => a.positional === 1)
    expect(pathArg).toBeDefined()
    expect(pathArg!.name).toBe('<path>')
  })

  it('includes short field separately from name', async () => {
    const result = await tool.execute({ command: 'help search' })
    const data = extractJson(result) as {
      arguments: Array<{ name: string; short?: string }>
    }

    // name should be machine-readable (--verbose), short alias in separate field
    const verboseArg = data.arguments.find((a) => a.name === '--verbose')
    expect(verboseArg).toBeDefined()
    expect(verboseArg!.short).toBe('v')

    const extArg = data.arguments.find((a) => a.name === '--ext')
    expect(extArg).toBeDefined()
    expect(extArg!.short).toBe('e')

    // No short alias
    const limitArg = data.arguments.find((a) => a.name === '--limit')
    expect(limitArg!.short).toBeUndefined()
  })

  it('marks boolean args as negatable', async () => {
    const result = await tool.execute({ command: 'help search' })
    const data = extractJson(result) as {
      arguments: Array<{ name: string; type: string; negatable?: boolean }>
    }

    const verboseArg = data.arguments.find((a) => a.name === '--verbose')
    expect(verboseArg!.negatable).toBe(true)

    const colorArg = data.arguments.find((a) => a.name === '--color')
    expect(colorArg!.negatable).toBe(true)

    // Non-boolean args should not have negatable
    const limitArg = data.arguments.find((a) => a.name === '--limit')
    expect(limitArg!.negatable).toBeUndefined()
  })

  it('shows array element type as string[]', async () => {
    const result = await tool.execute({ command: 'help search' })
    const data = extractJson(result) as {
      arguments: Array<{ name: string; type: string }>
    }

    const extArg = data.arguments.find((a) => a.name === '--ext')
    expect(extArg!.type).toBe('string[]')
  })

  it('generates usage line', async () => {
    const result = await tool.execute({ command: 'help search' })
    const data = extractJson(result) as { usage?: string }

    expect(data.usage).toBeDefined()
    expect(data.usage).toContain('search')
    // Positional args
    expect(data.usage).toContain('<query>')
    expect(data.usage).toContain('[<path>]')
    // Boolean flags
    expect(data.usage).toContain('[--verbose]')
    expect(data.usage).toContain('[--color]')
    // Optional named
    expect(data.usage).toContain('[--limit <number>]')
    // Array
    expect(data.usage).toContain('[--ext <string>...]')
  })

  it('generates usage line with required args first', async () => {
    const result = await tool.execute({ command: 'help search' })
    const data = extractJson(result) as { usage: string }

    // <query> should come before [<path>]
    const queryIdx = data.usage.indexOf('<query>')
    const pathIdx = data.usage.indexOf('[<path>]')
    expect(queryIdx).toBeLessThan(pathIdx)
  })

  it('omits usage and arguments for commands without args', async () => {
    const noArgCmd = defineCommand({
      description: 'No args command',
      args: {},
      handler: async () => ({ ok: true }),
    })
    const noArgTool = createAcli({ noarg: noArgCmd } as CommandRegistry)
    const result = await noArgTool.execute({ command: 'help noarg' })
    const data = extractJson(result) as { usage?: string; arguments?: unknown[] }
    expect(data.usage).toBeUndefined()
    expect(data.arguments).toBeUndefined()
  })
})

describe('aclify integration', () => {
  // Simulate MCP-style tool definitions
  const mcpTools: McpToolLike[] = [
    {
      name: 'add',
      description: 'Add two numbers',
      inputSchema: { a: z.coerce.number(), b: z.coerce.number() },
      handler: async ({ a, b }) => ({ result: a + b }),
    },
    {
      name: 'greet',
      description: 'Greet someone',
      inputSchema: { name: z.string().default('World') },
      handler: async ({ name }) => ({
        message: `Hello, ${name}!`,
      }),
    },
  ]

  const commands = aclify(mcpTools)
  const tool = createAcli(commands)

  it('executes aclified command', async () => {
    const result = await tool.execute({ command: 'add --a 10 --b 20' })
    expect(result.isError).toBeFalsy()

    const data = extractJson(result)
    expect(data).toEqual({ result: 30 })
  })

  it('uses default values in aclified command', async () => {
    const result = await tool.execute({ command: 'greet' })
    expect(result.isError).toBeFalsy()

    const data = extractJson(result)
    expect(data).toEqual({ message: 'Hello, World!' })
  })

  it('overrides default values in aclified command', async () => {
    const result = await tool.execute({ command: 'greet --name Alice' })
    expect(result.isError).toBeFalsy()

    const data = extractJson(result)
    expect(data).toEqual({ message: 'Hello, Alice!' })
  })

  it('shows aclified commands in help', async () => {
    const result = await tool.execute({ command: 'help' })
    expect(result.isError).toBeFalsy()

    const data = extractJson(result) as { commands: Array<{ name: string }> }
    const commandNames = data.commands.map((c) => c.name)
    expect(commandNames).toContain('add')
    expect(commandNames).toContain('greet')
  })
})
