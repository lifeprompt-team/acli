import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const shared = {
  minify: false,
  splitting: false,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
} as const

export default defineConfig([
  // Library entries (index + cli)
  {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    ...shared,
  },
  // REPL module (imported by bin, also usable standalone)
  {
    entry: ['src/repl.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: false,
    ...shared,
  },
  // CLI binary (npx @lifeprompt/acli) — with shebang
  {
    entry: ['src/bin.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: false,
    banner: { js: '#!/usr/bin/env node' },
    ...shared,
  },
])
