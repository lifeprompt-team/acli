import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseArgs } from '../parser/args'
import { tokenize } from '../parser/tokenizer'
import { arg } from '../router/registry'

// ============================================================
// Unicode & Multibyte Character Tests
// ============================================================

describe('unicode & multibyte characters', () => {
  describe('tokenizer - unicode handling', () => {
    it('tokenizes Japanese (hiragana/katakana/kanji)', () => {
      const result = tokenize('echo こんにちは世界')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'こんにちは世界'])
      }
    })

    it('tokenizes Chinese characters', () => {
      const result = tokenize('search 你好世界')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['search', '你好世界'])
      }
    })

    it('tokenizes Korean characters', () => {
      const result = tokenize('search 안녕하세요')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['search', '안녕하세요'])
      }
    })

    it('tokenizes emoji', () => {
      const result = tokenize('echo 🚀🎉✨')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', '🚀🎉✨'])
      }
    })

    it('tokenizes mixed ASCII and unicode', () => {
      const result = tokenize('greet --name "田中太郎" --greeting hello')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['greet', '--name', '田中太郎', '--greeting', 'hello'])
      }
    })

    it('handles unicode in single quotes', () => {
      const result = tokenize("echo '日本語テスト'")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', '日本語テスト'])
      }
    })

    it('handles unicode in double quotes', () => {
      const result = tokenize('echo "Ünïcödë tëst"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'Ünïcödë tëst'])
      }
    })

    it('handles unicode with spaces in quotes', () => {
      const result = tokenize('search "東京 タワー"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['search', '東京 タワー'])
      }
    })

    it('handles combining characters (diacritics)', () => {
      const result = tokenize('echo café résumé naïve')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'café', 'résumé', 'naïve'])
      }
    })

    it('handles full-width characters', () => {
      const result = tokenize('echo ＦＵＬＬ　ＷＩＤＴＨ')
      expect(result.ok).toBe(true)
      if (result.ok) {
        // Full-width space (U+3000) is whitespace, so it splits
        expect(result.value).toEqual(['echo', 'ＦＵＬＬ', 'ＷＩＤＴＨ'])
      }
    })

    it('handles RTL text (Arabic)', () => {
      const result = tokenize('echo مرحبا')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'مرحبا'])
      }
    })

    it('handles surrogate pairs (complex emoji)', () => {
      // 👨‍👩‍👧‍👦 is a ZWJ sequence
      const result = tokenize('echo 👨‍👩‍👧‍👦')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', '👨‍👩‍👧‍👦'])
      }
    })
  })

  describe('argument parser - unicode values', () => {
    it('parses unicode string arguments', () => {
      const argDefs = {
        name: arg(z.string()),
      }
      const result = parseArgs(['--name', '太郎'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('太郎')
      }
    })

    it('parses unicode positional arguments', () => {
      const argDefs = {
        query: arg(z.string(), { positional: 0 }),
      }
      const result = parseArgs(['検索クエリ'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.query).toBe('検索クエリ')
      }
    })

    it('parses emoji in string arguments', () => {
      const argDefs = {
        status: arg(z.string()),
      }
      const result = parseArgs(['--status', '✅完了'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.status).toBe('✅完了')
      }
    })

    it('parses unicode enum values', () => {
      const argDefs = {
        lang: arg(z.enum(['日本語', '英語', '中国語'])),
      }
      const result = parseArgs(['--lang', '日本語'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.lang).toBe('日本語')
      }
    })

    it('parses unicode array arguments', () => {
      const argDefs = {
        tag: arg(z.array(z.string())),
      }
      const result = parseArgs(['--tag', 'タグ1', '--tag', 'タグ2'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tag).toEqual(['タグ1', 'タグ2'])
      }
    })

    it('handles inline unicode values with equals', () => {
      const argDefs = {
        title: arg(z.string()),
      }
      const result = parseArgs(['--title=日本語タイトル'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.title).toBe('日本語タイトル')
      }
    })
  })
})

// ============================================================
// Boundary Value Tests
// ============================================================

describe('boundary values', () => {
  describe('tokenizer - length boundaries', () => {
    it('accepts command at exactly max length (10000)', () => {
      const command = 'x'.repeat(10000)
      const result = tokenize(command)
      expect(result.ok).toBe(true)
    })

    it('rejects command at max length + 1 (10001)', () => {
      const command = 'x'.repeat(10001)
      const result = tokenize(command)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })

    it('accepts exactly 100 arguments', () => {
      const command = Array(100).fill('a').join(' ')
      const result = tokenize(command)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(100)
      }
    })

    it('rejects 101 arguments', () => {
      const command = Array(101).fill('a').join(' ')
      const result = tokenize(command)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })

    it('accepts single argument at exactly max length (10000)', () => {
      const longArg = 'x'.repeat(10000)
      const result = tokenize(longArg)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value[0]).toHaveLength(10000)
      }
    })

    it('rejects single argument at max length + 1 (10001)', () => {
      // Put a space before so that 'a' + long arg = two tokens,
      // where the second token exceeds max arg length
      const longArg = `a ${'x'.repeat(10001)}`
      const result = tokenize(longArg)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })

    it('handles single character input', () => {
      const result = tokenize('a')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['a'])
      }
    })

    it('handles whitespace-only input', () => {
      const result = tokenize('   ')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual([])
      }
    })

    it('handles tab characters as whitespace', () => {
      const result = tokenize('foo\tbar\tbaz')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['foo', 'bar', 'baz'])
      }
    })
  })

  describe('argument parser - edge cases', () => {
    it('handles empty string argument value', () => {
      const argDefs = {
        name: arg(z.string()),
      }
      // "--name" followed by empty quoted string is tokenized as ['--name', '']
      const result = parseArgs(['--name', ''], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('')
      }
    })

    it('handles zero as number argument', () => {
      const argDefs = {
        count: arg(z.coerce.number()),
      }
      const result = parseArgs(['--count', '0'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.count).toBe(0)
      }
    })

    it('handles negative numbers', () => {
      const argDefs = {
        offset: arg(z.coerce.number()),
      }
      // Use -- to prevent -10 being parsed as an option
      const result = parseArgs(['--offset', '-10'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.offset).toBe(-10)
      }
    })

    it('handles very large numbers', () => {
      const argDefs = {
        big: arg(z.coerce.number()),
      }
      const result = parseArgs(['--big', '999999999999'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.big).toBe(999999999999)
      }
    })

    it('handles float precision', () => {
      const argDefs = {
        value: arg(z.coerce.number()),
      }
      const result = parseArgs(['--value', '0.1'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.value).toBeCloseTo(0.1)
      }
    })

    it('rejects NaN for number arguments', () => {
      const argDefs = {
        count: arg(z.coerce.number()),
      }
      const result = parseArgs(['--count', 'notanumber'], argDefs)
      expect(result.ok).toBe(false)
    })

    it('handles boolean edge case: explicit "true"', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--verbose', 'true'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(true)
      }
    })

    it('handles boolean edge case: --no- prefix sets false', () => {
      const argDefs = {
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['--no-verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verbose).toBe(false)
      }
    })

    it('handles many positional arguments', () => {
      const argDefs = {
        a: arg(z.string(), { positional: 0 }),
        b: arg(z.string(), { positional: 1 }),
        c: arg(z.string(), { positional: 2 }),
        d: arg(z.string(), { positional: 3 }),
        e: arg(z.string(), { positional: 4 }),
      }
      const result = parseArgs(['one', 'two', 'three', 'four', 'five'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.a).toBe('one')
        expect(result.value.b).toBe('two')
        expect(result.value.c).toBe('three')
        expect(result.value.d).toBe('four')
        expect(result.value.e).toBe('five')
      }
    })

    it('handles special string values that look like options', () => {
      const argDefs = {
        value: arg(z.string(), { positional: 0 }),
      }
      // After --, everything is positional
      const result = parseArgs(['--', '--not-an-option'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.value).toBe('--not-an-option')
      }
    })

    it('handles ISO date at boundaries', () => {
      const argDefs = {
        date: arg(z.coerce.date()),
      }
      const result = parseArgs(['--date', '2026-01-01T00:00:00.000Z'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.date).toBeInstanceOf(Date)
      }
    })

    it('handles string with only whitespace', () => {
      const argDefs = {
        value: arg(z.string()),
      }
      // Whitespace-only string from tokenizer (via quotes)
      const result = parseArgs(['--value', '   '], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.value).toBe('   ')
      }
    })

    it('handles mixed positional and named arguments', () => {
      const argDefs = {
        query: arg(z.string(), { positional: 0 }),
        limit: arg(z.coerce.number().default(10)),
        verbose: arg(z.boolean().default(false)),
      }
      const result = parseArgs(['search-term', '--limit', '5', '--verbose'], argDefs)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.query).toBe('search-term')
        expect(result.value.limit).toBe(5)
        expect(result.value.verbose).toBe(true)
      }
    })
  })
})
