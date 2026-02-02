import { describe, expect, it } from 'vitest'
import { tokenize } from '../parser/tokenizer'

describe('tokenizer', () => {
  describe('basic tokenization', () => {
    it('splits by whitespace', () => {
      const result = tokenize('calendar events --today')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['calendar', 'events', '--today'])
      }
    })

    it('handles empty input', () => {
      const result = tokenize('')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual([])
      }
    })

    it('handles multiple spaces', () => {
      const result = tokenize('foo   bar    baz')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['foo', 'bar', 'baz'])
      }
    })
  })

  describe('quote handling', () => {
    it('handles double quotes', () => {
      const result = tokenize('echo "hello world"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'hello world'])
      }
    })

    it('handles single quotes', () => {
      const result = tokenize("echo 'hello world'")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'hello world'])
      }
    })

    it('handles nested quotes', () => {
      const result = tokenize('echo "it\'s working"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', "it's working"])
      }
    })

    it('rejects unclosed single quote', () => {
      const result = tokenize("echo 'hello")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })

    it('rejects unclosed double quote', () => {
      const result = tokenize('echo "hello')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })
  })

  describe('escape handling', () => {
    it('blocks backslash for security', () => {
      // Backslash is blocked to prevent escape sequence attacks
      const result = tokenize('echo hello\\ world')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('allows quotes to escape spaces instead', () => {
      const result = tokenize('echo "hello world"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'hello world'])
      }
    })
  })

  describe('security - injection prevention', () => {
    it('blocks semicolon', () => {
      const result = tokenize('foo; rm -rf /')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('blocks pipe', () => {
      const result = tokenize('foo | bar')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('blocks ampersand', () => {
      const result = tokenize('foo && bar')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('blocks backticks', () => {
      const result = tokenize('echo `whoami`')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('blocks dollar sign', () => {
      const result = tokenize('echo $HOME')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('blocks parentheses', () => {
      const result = tokenize('$(whoami)')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })

    it('blocks redirect', () => {
      const result = tokenize('echo foo > /etc/passwd')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('INJECTION_BLOCKED')
      }
    })
  })

  describe('constraints', () => {
    it('respects max command length', () => {
      const longCommand = 'x'.repeat(10001)
      const result = tokenize(longCommand)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })

    it('respects max argument count', () => {
      const manyArgs = Array(101).fill('arg').join(' ')
      const result = tokenize(manyArgs)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.error.code).toBe('PARSE_ERROR')
      }
    })
  })
})
