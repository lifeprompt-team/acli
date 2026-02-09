import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseArgs } from '../parser/args'
import { arg, csvArg } from '../router/registry'

describe('argument parser', () => {
  describe('basic parsing', () => {
    it('parses string and number options', () => {
      const argDefs = {
        name: arg(z.string()),
        count: arg(z.coerce.number().int()),
      }
      const result = parseArgs(['--name', 'test', '--count', '10'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('test')
        expect(result.value.count).toBe(10)
      }
    })

    it('parses inline values', () => {
      const argDefs = {
        name: arg(z.string()),
      }
      const result = parseArgs(['--name=hello'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('hello')
      }
    })

    it('parses flags (boolean with default)', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
        quiet: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.quiet).toBe(false)
      }
    })

    it('parses short options', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
        name: arg(z.string()),
      }
      const result = parseArgs(['-v', '-n', 'test'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.name).toBe('test')
      }
    })
  })

  describe('type coercion', () => {
    it('coerces string to number', () => {
      const argDefs = {
        count: arg(z.coerce.number().int()),
      }
      const result = parseArgs(['--count', '42'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(42)
      }
    })

    it('rejects invalid numbers', () => {
      const argDefs = {
        count: arg(z.coerce.number().int()),
      }
      const result = parseArgs(['--count', 'abc'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('coerces to date', () => {
      const argDefs = {
        date: arg(z.coerce.date()),
      }
      const result = parseArgs(['--date', '2026-02-02T10:00:00Z'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.date).toBeInstanceOf(Date)
      }
    })

    it('parses float numbers', () => {
      const argDefs = {
        rate: arg(z.coerce.number()),
      }
      const result = parseArgs(['--rate', '3.14'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rate).toBeCloseTo(3.14)
      }
    })
  })

  describe('defaults', () => {
    it('applies default values', () => {
      const argDefs = {
        count: arg(z.coerce.number().default(10)),
      }
      const result = parseArgs([], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(10)
      }
    })

    it('overrides defaults', () => {
      const argDefs = {
        count: arg(z.coerce.number().default(10)),
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
      const argDefs = {
        name: arg(z.string()), // required by default in zod
      }
      const result = parseArgs([], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('allows optional arguments', () => {
      const argDefs = {
        name: arg(z.string().optional()),
      }
      const result = parseArgs([], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBeUndefined()
      }
    })
  })

  describe('unknown arguments', () => {
    it('rejects unknown options', () => {
      const argDefs = {
        known: arg(z.string()),
      }
      const result = parseArgs(['--unknown', 'value'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('positional arguments', () => {
    it('parses positional arguments', () => {
      const argDefs = {
        a: arg(z.coerce.number(), { positional: 0 }),
        b: arg(z.coerce.number(), { positional: 1 }),
      }
      const result = parseArgs(['10', '20'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.a).toBe(10)
        expect(result.value.b).toBe(20)
      }
    })

    it('mixes positional and named arguments', () => {
      const argDefs = {
        a: arg(z.coerce.number(), { positional: 0 }),
        b: arg(z.coerce.number(), { positional: 1 }),
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['10', '20', '--verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.a).toBe(10)
        expect(result.value.b).toBe(20)
        expect(result.value.verbose).toBe(true)
      }
    })

    it('validates required positional arguments', () => {
      const argDefs = {
        a: arg(z.coerce.number(), { positional: 0 }),
        b: arg(z.coerce.number(), { positional: 1 }),
      }
      const result = parseArgs(['10'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('handles positional type errors', () => {
      const argDefs = {
        count: arg(z.coerce.number().int(), { positional: 0 }),
      }
      const result = parseArgs(['not-a-number'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('advanced validation', () => {
    it('validates string with min length', () => {
      const argDefs = {
        name: arg(z.string().min(3, 'Name must be at least 3 characters')),
      }
      const result = parseArgs(['--name', 'ab'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.message).toContain('at least 3 characters')
      }
    })

    it('validates number in range', () => {
      const argDefs = {
        age: arg(z.coerce.number().min(0).max(150)),
      }
      const result = parseArgs(['--age', '200'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('validates enum values', () => {
      const argDefs = {
        level: arg(z.enum(['debug', 'info', 'warn', 'error'])),
      }
      const result = parseArgs(['--level', 'info'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.level).toBe('info')
      }
    })

    it('rejects invalid enum values', () => {
      const argDefs = {
        level: arg(z.enum(['debug', 'info', 'warn', 'error'])),
      }
      const result = parseArgs(['--level', 'invalid'], argDefs)
      expect(result.ok).toBe(false)
    })

    it('validates regex patterns', () => {
      const argDefs = {
        email: arg(z.string().email()),
      }
      const result = parseArgs(['--email', 'invalid-email'], argDefs)
      expect(result.ok).toBe(false)
    })

    it('accepts valid email', () => {
      const argDefs = {
        email: arg(z.string().email()),
      }
      const result = parseArgs(['--email', 'test@example.com'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.email).toBe('test@example.com')
      }
    })
  })

  describe('end of options separator (--)', () => {
    it('treats tokens after -- as positional arguments', () => {
      const argDefs = {
        message: arg(z.string(), { positional: 0 }),
      }
      const result = parseArgs(['--', '--not-a-flag'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.message).toBe('--not-a-flag')
      }
    })

    it('mixes named options before -- and positional after', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
        message: arg(z.string(), { positional: 0 }),
      }
      const result = parseArgs(['--verbose', '--', '--some-text'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.message).toBe('--some-text')
      }
    })

    it('handles multiple positional values after --', () => {
      const argDefs = {
        a: arg(z.string(), { positional: 0 }),
        b: arg(z.string(), { positional: 1 }),
      }
      const result = parseArgs(['--', '--first', '--second'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.a).toBe('--first')
        expect(result.value.b).toBe('--second')
      }
    })

    it('-- with no following tokens is a no-op', () => {
      const argDefs = {
        name: arg(z.string().optional()),
      }
      const result = parseArgs(['--'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBeUndefined()
      }
    })
  })

  describe('csv array arguments', () => {
    it('parses comma-separated string array', () => {
      const argDefs = {
        tags: csvArg(),
      }
      const result = parseArgs(['--tags', 'a,b,c'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tags).toEqual(['a', 'b', 'c'])
      }
    })

    it('trims whitespace around elements', () => {
      const argDefs = {
        tags: csvArg(),
      }
      const result = parseArgs(['--tags', 'a , b , c'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tags).toEqual(['a', 'b', 'c'])
      }
    })

    it('parses comma-separated number array', () => {
      const argDefs = {
        ids: csvArg({ item: z.coerce.number() }),
      }
      const result = parseArgs(['--ids', '1,2,3'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.ids).toEqual([1, 2, 3])
      }
    })

    it('validates each element with item schema', () => {
      const argDefs = {
        emails: csvArg({ item: z.string().email() }),
      }
      const result = parseArgs(['--emails', 'a@b.com,invalid'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('handles single element', () => {
      const argDefs = {
        tags: csvArg(),
      }
      const result = parseArgs(['--tags', 'single'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tags).toEqual(['single'])
      }
    })

    it('supports custom separator', () => {
      const argDefs = {
        items: csvArg({ separator: '|' }),
      }
      const result = parseArgs(['--items', 'a|b|c'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.items).toEqual(['a', 'b', 'c'])
      }
    })

    it('supports metadata', () => {
      const argDefs = {
        tags: csvArg({ meta: { description: 'Comma-separated tags' } }),
      }
      expect(argDefs.tags.meta.description).toBe('Comma-separated tags')
    })
  })

  describe('empty args', () => {
    it('handles empty args definition', () => {
      const result = parseArgs([], {})
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual({})
      }
    })
  })
})
