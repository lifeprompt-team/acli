import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  aclify,
  arg,
  type CommandRegistry,
  extractCommandPath,
  findCommand,
  listCommands,
} from '../router/registry'

describe('command registry', () => {
  // Commands with subcommands can be defined as plain objects
  const testCommands: CommandRegistry = {
    calendar: {
      description: 'Manage calendar',
      subcommands: {
        events: {
          description: 'List events',
          args: {
            today: arg(z.boolean().default(false), { description: 'Today only' }),
          },
          handler: async () => ({ events: [] }),
        },
        create: {
          description: 'Create event',
          handler: async () => ({ id: '123' }),
        },
      },
    },
    tasks: {
      description: 'Manage tasks',
      handler: async () => ({ tasks: [] }),
    },
  }

  describe('findCommand', () => {
    it('finds top-level command', () => {
      const cmd = findCommand(testCommands, ['calendar'])
      expect(cmd).not.toBeNull()
      expect(cmd?.description).toBe('Manage calendar')
    })

    it('finds nested command', () => {
      const cmd = findCommand(testCommands, ['calendar', 'events'])
      expect(cmd).not.toBeNull()
      expect(cmd?.description).toBe('List events')
    })

    it('returns null for empty path', () => {
      const cmd = findCommand(testCommands, [])
      expect(cmd).toBeNull()
    })

    it('returns null for unknown command', () => {
      const cmd = findCommand(testCommands, ['unknown'])
      expect(cmd).toBeNull()
    })

    it('returns parent for unknown subcommand', () => {
      const cmd = findCommand(testCommands, ['calendar', 'unknown'])
      expect(cmd).not.toBeNull()
      expect(cmd?.description).toBe('Manage calendar')
    })
  })

  describe('extractCommandPath', () => {
    it('extracts simple command', () => {
      const [path, args] = extractCommandPath(testCommands, ['tasks'])
      expect(path).toEqual(['tasks'])
      expect(args).toEqual([])
    })

    it('extracts nested command', () => {
      const [path, args] = extractCommandPath(testCommands, ['calendar', 'events'])
      expect(path).toEqual(['calendar', 'events'])
      expect(args).toEqual([])
    })

    it('extracts command with args', () => {
      const [path, args] = extractCommandPath(testCommands, ['calendar', 'events', '--today'])
      expect(path).toEqual(['calendar', 'events'])
      expect(args).toEqual(['--today'])
    })

    it('stops at options', () => {
      const [path, args] = extractCommandPath(testCommands, ['calendar', '--help', 'events'])
      expect(path).toEqual(['calendar'])
      expect(args).toEqual(['--help', 'events'])
    })

    it('returns empty path for unknown command', () => {
      const [path, args] = extractCommandPath(testCommands, ['unknown'])
      expect(path).toEqual([])
      expect(args).toEqual(['unknown'])
    })
  })

  describe('listCommands', () => {
    it('lists all commands', () => {
      const commands = listCommands(testCommands)
      expect(commands).toContainEqual({
        name: 'calendar',
        description: 'Manage calendar',
      })
      expect(commands).toContainEqual({
        name: 'calendar events',
        description: 'List events',
      })
      expect(commands).toContainEqual({
        name: 'calendar create',
        description: 'Create event',
      })
      expect(commands).toContainEqual({
        name: 'tasks',
        description: 'Manage tasks',
      })
    })
  })
})

describe('aclify', () => {
  it('converts MCP-style tools to CommandRegistry', () => {
    const mcpTools = [
      {
        name: 'add',
        description: 'Add two numbers',
        inputSchema: { a: z.number(), b: z.number() },
        handler: async ({ a, b }: { a: number; b: number }) => ({ result: a + b }),
      },
      {
        name: 'multiply',
        description: 'Multiply two numbers',
        inputSchema: { a: z.number(), b: z.number() },
        handler: async ({ a, b }: { a: number; b: number }) => ({ result: a * b }),
      },
    ]

    const commands = aclify(mcpTools)

    expect(commands.add).toBeDefined()
    expect(commands.add.description).toBe('Add two numbers')
    expect(commands.add.args).toBeDefined()
    expect(commands.add.args?.a).toBeDefined()
    expect(commands.add.args?.b).toBeDefined()

    expect(commands.multiply).toBeDefined()
    expect(commands.multiply.description).toBe('Multiply two numbers')
  })

  it('handlers work correctly after conversion', async () => {
    const mcpTools = [
      {
        name: 'greet',
        description: 'Greet someone',
        inputSchema: { name: z.string() },
        handler: async ({ name }: { name: string }) => ({ message: `Hello, ${name}!` }),
      },
    ]

    const commands = aclify(mcpTools)
    const result = await commands.greet.handler?.({ name: 'World' })

    expect(result).toEqual({ message: 'Hello, World!' })
  })

  it('preserves Zod schema validation', () => {
    const mcpTools = [
      {
        name: 'test',
        description: 'Test command',
        inputSchema: { count: z.number().min(0).max(100) },
        handler: async ({ count }: { count: number }) => ({ count }),
      },
    ]

    const commands = aclify(mcpTools)
    const schema = commands.test.args?.count.schema

    expect(schema?.safeParse(50).success).toBe(true)
    expect(schema?.safeParse(-1).success).toBe(false)
    expect(schema?.safeParse(101).success).toBe(false)
  })

  it('handles empty tool array', () => {
    const commands = aclify([])
    expect(commands).toEqual({})
  })

  it('handles tools with no input schema', () => {
    const mcpTools = [
      {
        name: 'ping',
        description: 'Ping command',
        inputSchema: {},
        handler: async () => ({ pong: true }),
      },
    ]

    const commands = aclify(mcpTools)
    expect(commands.ping).toBeDefined()
    expect(commands.ping.args).toEqual({})
  })
})
