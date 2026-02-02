import { describe, it, expect } from 'vitest'
import {
  defineCommands,
  findCommand,
  extractCommandPath,
  listCommands,
} from '../router/registry'

describe('command registry', () => {
  const testCommands = defineCommands({
    calendar: {
      description: 'Manage calendar',
      subcommands: {
        events: {
          description: 'List events',
          args: {
            today: { type: 'flag', description: 'Today only' },
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
  })

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
      const [path, args] = extractCommandPath(testCommands, [
        'calendar',
        'events',
        '--today',
      ])
      expect(path).toEqual(['calendar', 'events'])
      expect(args).toEqual(['--today'])
    })

    it('stops at options', () => {
      const [path, args] = extractCommandPath(testCommands, [
        'calendar',
        '--help',
        'events',
      ])
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
