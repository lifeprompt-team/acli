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
    it('handles backslash escape for spaces', () => {
      const result = tokenize('echo hello\\ world')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'hello world'])
      }
    })

    it('handles backslash escape for special characters', () => {
      // Backslash treats the next character as literal (no shell escape sequence expansion)
      const result = tokenize('echo "hello\\nworld"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        // \n is treated as literal "n", not a newline character
        expect(result.value).toEqual(['echo', 'hellonworld'])
      }
    })

    it('allows quotes to escape spaces', () => {
      const result = tokenize('echo "hello world"')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'hello world'])
      }
    })
  })

  describe('special characters - treated as plain text', () => {
    // ACLI doesn't use shell, so these characters are treated as plain text
    it('treats semicolon as plain text', () => {
      const result = tokenize('foo; rm -rf /')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['foo;', 'rm', '-rf', '/'])
      }
    })

    it('treats pipe as plain text', () => {
      const result = tokenize('foo | bar')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['foo', '|', 'bar'])
      }
    })

    it('treats ampersand as plain text', () => {
      const result = tokenize('foo && bar')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['foo', '&&', 'bar'])
      }
    })

    it('treats backticks as plain text', () => {
      const result = tokenize('echo `whoami`')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', '`whoami`'])
      }
    })

    it('treats dollar sign as plain text', () => {
      const result = tokenize('echo $HOME')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', '$HOME'])
      }
    })

    it('treats parentheses as plain text', () => {
      const result = tokenize('$(whoami)')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['$(whoami)'])
      }
    })

    it('treats redirect symbols as plain text', () => {
      const result = tokenize('echo foo > /etc/passwd')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['echo', 'foo', '>', '/etc/passwd'])
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
