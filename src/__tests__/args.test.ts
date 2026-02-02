import { describe, it, expect } from 'vitest'
import { parseArgs } from '../parser/args'
import type { ArgumentDefinition } from '../router/registry'

describe('argument parser', () => {
  describe('basic parsing', () => {
    it('parses long options', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        name: { type: 'string' },
        count: { type: 'integer' },
      }
      const result = parseArgs(['--name', 'test', '--count', '10'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('test')
        expect(result.value.count).toBe(10)
      }
    })

    it('parses inline values', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        name: { type: 'string' },
      }
      const result = parseArgs(['--name=hello'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('hello')
      }
    })

    it('parses flags', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        verbose: { type: 'flag' },
        quiet: { type: 'flag' },
      }
      const result = parseArgs(['--verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.quiet).toBeUndefined()
      }
    })
  })

  describe('type coercion', () => {
    it('parses integers', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        count: { type: 'integer' },
      }
      const result = parseArgs(['--count', '42'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(42)
      }
    })

    it('rejects invalid integers', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        count: { type: 'integer' },
      }
      const result = parseArgs(['--count', 'abc'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('parses numbers', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        rate: { type: 'number' },
      }
      const result = parseArgs(['--rate', '3.14'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rate).toBeCloseTo(3.14)
      }
    })

    it('parses booleans', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        enabled: { type: 'boolean' },
      }
      const result = parseArgs(['--enabled', 'true'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.enabled).toBe(true)
      }
    })

    it('parses arrays', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        tags: { type: 'array' },
      }
      const result = parseArgs(['--tags', 'a,b,c'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tags).toEqual(['a', 'b', 'c'])
      }
    })

    it('parses datetime', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        date: { type: 'datetime' },
      }
      const result = parseArgs(['--date', '2026-02-02T10:00:00Z'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.date).toBeInstanceOf(Date)
      }
    })
  })

  describe('defaults', () => {
    it('applies default values', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        count: { type: 'integer', default: 10 },
      }
      const result = parseArgs([], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(10)
      }
    })

    it('overrides defaults', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        count: { type: 'integer', default: 10 },
      }
      const result = parseArgs(['--count', '20'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(20)
      }
    })
  })

  describe('required arguments', () => {
    it('validates required arguments', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        name: { type: 'string', required: true },
      }
      const result = parseArgs([], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('unknown arguments', () => {
    it('rejects unknown options', () => {
      const argDefs: Record<string, ArgumentDefinition> = {
        known: { type: 'string' },
      }
      const result = parseArgs(['--unknown', 'value'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })
})
