import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseArgs } from '../parser/args'
import { arg } from '../router/registry'

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

    it('preserves equals signs in inline values', () => {
      const argDefs = {
        query: arg(z.string()),
      }
      const result = parseArgs(['--query=SELECT * WHERE a=1 AND b=2'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.query).toBe('SELECT * WHERE a=1 AND b=2')
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

    it('parses short options with explicit short alias', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        name: arg(z.string(), { short: 'n' }),
      }
      const result = parseArgs(['-v', '-n', 'test'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.name).toBe('test')
      }
    })

    it('rejects short option without explicit short alias', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['-v'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('combined short options', () => {
    it('combines multiple boolean short flags: -vq', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        quiet: arg(z.boolean().default(false), { short: 'q' }),
      }
      const result = parseArgs(['-vq'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.quiet).toBe(true)
      }
    })

    it('combines three boolean short flags: -abc', () => {
      const argDefs = {
        all: arg(z.boolean().default(false), { short: 'a' }),
        bold: arg(z.boolean().default(false), { short: 'b' }),
        color: arg(z.boolean().default(false), { short: 'c' }),
      }
      const result = parseArgs(['-abc'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.all).toBe(true)
        expect(result.value.bold).toBe(true)
        expect(result.value.color).toBe(true)
      }
    })

    it('short option with attached value: -Hvalue', () => {
      const argDefs = {
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-HBearer_token'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.header).toBe('Bearer_token')
      }
    })

    it('short option with = value: -H=value', () => {
      const argDefs = {
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-H=Bearer_token'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.header).toBe('Bearer_token')
      }
    })

    it('combined flags + value option with space: -vH value', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-vH', 'Bearer_token'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.header).toBe('Bearer_token')
      }
    })

    it('combined flags + attached value: -vHvalue', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-vHBearer_token'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.header).toBe('Bearer_token')
      }
    })

    it('combined flags + = value: -vH=value', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-vH=Bearer_token'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.header).toBe('Bearer_token')
      }
    })

    it('rejects unknown short option in combination', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
      }
      const result = parseArgs(['-vx'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.error.message).toContain('-x')
      }
    })

    it('rejects multi-char token starting with - when no short alias matches', () => {
      const argDefs = {
        name: arg(z.string()),
      }
      const result = parseArgs(['-abc'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('value-taking short option at end of combination requires next token', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-vH'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.message).toContain('-H')
        expect(result.error.error.message).toContain('requires a value')
      }
    })

    it('accumulates array via combined short option', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
        env: arg(z.array(z.string()), { short: 'e' }),
      }
      const result = parseArgs(['-ve', 'FOO=1', '-ve', 'BAR=2'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
        expect(result.value.env).toEqual(['FOO=1', 'BAR=2'])
      }
    })

    it('repeated same flag: -vv is same as -v', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false), { short: 'v' }),
      }
      const result = parseArgs(['-vv'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
      }
    })

    it('-H= (equals with empty value) passes empty string', () => {
      const argDefs = {
        header: arg(z.string(), { short: 'H' }),
      }
      const result = parseArgs(['-H='], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.header).toBe('')
      }
    })

    it('short option with negative number as attached value: -n-5', () => {
      const argDefs = {
        num: arg(z.coerce.number(), { short: 'n' }),
      }
      const result = parseArgs(['-n-5'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.num).toBe(-5)
      }
    })

    it('short option with numeric attached value: -n10', () => {
      const argDefs = {
        num: arg(z.coerce.number(), { short: 'n' }),
      }
      const result = parseArgs(['-n10'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.num).toBe(10)
      }
    })

    it('single dash "-" is treated as positional, not short option', () => {
      const argDefs = {
        file: arg(z.string(), { positional: 0 }),
      }
      const result = parseArgs(['-'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.file).toBe('-')
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

  describe('--no- prefix (flag negation)', () => {
    it('negates a boolean flag with default', () => {
      const argDefs = {
        color: arg(z.boolean().default(true)),
      }
      const result = parseArgs(['--no-color'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.color).toBe(false)
      }
    })

    it('negates a boolean flag with default false', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--no-verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(false)
      }
    })

    it('negates an optional boolean', () => {
      const argDefs = {
        cache: arg(z.boolean().optional()),
      }
      const result = parseArgs(['--no-cache'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.cache).toBe(false)
      }
    })

    it('rejects --no- on non-boolean argument', () => {
      const argDefs = {
        name: arg(z.string()),
      }
      const result = parseArgs(['--no-name'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.message).toContain('can only be used with boolean flags')
      }
    })

    it('rejects --no- for unknown argument', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--no-unknown'], argDefs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('--no- overrides previous --flag', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--verbose', '--no-verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(false)
      }
    })

    it('--flag overrides previous --no-flag', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--no-verbose', '--verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
      }
    })

    it('handles hyphenated flag names with --no-', () => {
      const argDefs = {
        dry_run: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--no-dry-run'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.dry_run).toBe(false)
      }
    })

    it('prefers literal arg name over --no- negation', () => {
      const argDefs = {
        no_reply: arg(z.boolean().default(false)),
      }
      // --no-reply matches literal arg "no_reply", should be treated as flag (true)
      const result = parseArgs(['--no-reply'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.no_reply).toBe(true)
      }
    })

    it('prefers literal arg name with value over --no- negation', () => {
      const argDefs = {
        no_reply_email: arg(z.string()),
      }
      // --no-reply-email matches literal arg "no_reply_email", treated as regular option
      const result = parseArgs(['--no-reply-email', 'test@example.com'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.no_reply_email).toBe('test@example.com')
      }
    })
  })

  describe('repeated options (array accumulation)', () => {
    it('accumulates repeated options into array', () => {
      const argDefs = {
        tag: arg(z.array(z.string())),
      }
      const result = parseArgs(['--tag', 'foo', '--tag', 'bar'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tag).toEqual(['foo', 'bar'])
      }
    })

    it('handles single value for array option', () => {
      const argDefs = {
        tag: arg(z.array(z.string())),
      }
      const result = parseArgs(['--tag', 'foo'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tag).toEqual(['foo'])
      }
    })

    it('handles optional array with repeated values', () => {
      const argDefs = {
        include: arg(z.array(z.string()).optional()),
      }
      const result = parseArgs(['--include', 'a', '--include', 'b', '--include', 'c'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.include).toEqual(['a', 'b', 'c'])
      }
    })

    it('handles array with default', () => {
      const argDefs = {
        ext: arg(z.array(z.string()).default(['.ts'])),
      }
      const result = parseArgs(['--ext', '.js', '--ext', '.tsx'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.ext).toEqual(['.js', '.tsx'])
      }
    })

    it('uses default when no values provided for array', () => {
      const argDefs = {
        ext: arg(z.array(z.string()).default(['.ts'])),
      }
      const result = parseArgs([], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.ext).toEqual(['.ts'])
      }
    })

    it('accumulates via short option', () => {
      const argDefs = {
        env: arg(z.array(z.string()), { short: 'e' }),
      }
      const result = parseArgs(['-e', 'FOO=1', '-e', 'BAR=2'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.env).toEqual(['FOO=1', 'BAR=2'])
      }
    })

    it('accumulates via inline value syntax', () => {
      const argDefs = {
        tag: arg(z.array(z.string())),
      }
      const result = parseArgs(['--tag=foo', '--tag=bar'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tag).toEqual(['foo', 'bar'])
      }
    })

    it('non-array repeated option uses last value', () => {
      const argDefs = {
        name: arg(z.string()),
      }
      const result = parseArgs(['--name', 'first', '--name', 'second'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('second')
      }
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

  describe('auto-coerce (z.number() → z.coerce.number())', () => {
    it('z.number() is automatically coerced from string', () => {
      const argDefs = {
        count: arg(z.number()),
      }
      const result = parseArgs(['--count', '42'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(42)
      }
    })

    it('z.number().int().min(0).max(100) preserves checks after coerce', () => {
      const argDefs = {
        age: arg(z.number().int().min(0).max(100)),
      }
      // Valid
      const ok = parseArgs(['--age', '25'], argDefs)
      expect(ok.ok).toBe(true)
      if (ok.ok) expect(ok.value.age).toBe(25)

      // Out of range
      const fail = parseArgs(['--age', '200'], argDefs)
      expect(fail.ok).toBe(false)

      // Not int
      const failFloat = parseArgs(['--age', '3.14'], argDefs)
      expect(failFloat.ok).toBe(false)
    })

    it('z.number().default(10) works without coerce', () => {
      const argDefs = {
        count: arg(z.number().default(10)),
      }
      // Default value
      const defaultResult = parseArgs([], argDefs)
      expect(defaultResult.ok).toBe(true)
      if (defaultResult.ok) expect(defaultResult.value.count).toBe(10)

      // Override
      const override = parseArgs(['--count', '99'], argDefs)
      expect(override.ok).toBe(true)
      if (override.ok) expect(override.value.count).toBe(99)
    })

    it('z.number().optional() works without coerce', () => {
      const argDefs = {
        count: arg(z.number().optional()),
      }
      // Omitted
      const omitted = parseArgs([], argDefs)
      expect(omitted.ok).toBe(true)
      if (omitted.ok) expect(omitted.value.count).toBeUndefined()

      // Provided
      const provided = parseArgs(['--count', '7'], argDefs)
      expect(provided.ok).toBe(true)
      if (provided.ok) expect(provided.value.count).toBe(7)
    })

    it('z.date() is automatically coerced from string', () => {
      const argDefs = {
        date: arg(z.date()),
      }
      const result = parseArgs(['--date', '2026-02-09T10:00:00Z'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.date).toBeInstanceOf(Date)
      }
    })

    it('z.bigint() is automatically coerced from string', () => {
      const argDefs = {
        big: arg(z.bigint()),
      }
      const result = parseArgs(['--big', '9007199254740993'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.big).toBe(9007199254740993n)
      }
    })

    it('z.array(z.number()) inner elements are auto-coerced', () => {
      const argDefs = {
        nums: arg(z.array(z.number())),
      }
      const result = parseArgs(['--nums', '1', '--nums', '2', '--nums', '3'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.nums).toEqual([1, 2, 3])
      }
    })

    it('z.coerce.number() is not double-wrapped', () => {
      const argDefs = {
        count: arg(z.coerce.number()),
      }
      const result = parseArgs(['--count', '42'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(42)
      }
    })

    it('positional z.number() is auto-coerced', () => {
      const argDefs = {
        a: arg(z.number(), { positional: 0 }),
        b: arg(z.number(), { positional: 1 }),
      }
      const result = parseArgs(['10', '20'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.a).toBe(10)
        expect(result.value.b).toBe(20)
      }
    })

    it('z.number().refine() works via parser-level coercion through ZodEffects', () => {
      const argDefs = {
        count: arg(z.number().refine((n) => n > 0)),
      }
      const result = parseArgs(['--count', '42'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(42)
      }
    })

    it('z.number().refine() rejects invalid values after coercion', () => {
      const argDefs = {
        count: arg(z.number().refine((n) => n > 0)),
      }
      const result = parseArgs(['--count', '-5'], argDefs)
      expect(result.ok).toBe(false)
    })
  })
})
