#!/usr/bin/env node
/**
 * Example: math CLI tool using acli
 *
 * Usage:
 *   node examples/math-cli.mjs add --a 10 --b 20
 *   node examples/math-cli.mjs multiply --a 5 --b 7
 *   node examples/math-cli.mjs help
 */

import { defineCommands, runCli } from '../dist/index.js'

const commands = defineCommands({
  add: {
    description: 'Add two numbers',
    args: {
      a: { type: 'number', required: true, description: 'First number' },
      b: { type: 'number', required: true, description: 'Second number' },
    },
    handler: async (args) => {
      const a = args.a
      const b = args.b
      return { result: a + b, expression: `${a} + ${b} = ${a + b}` }
    },
  },
  multiply: {
    description: 'Multiply two numbers',
    args: {
      a: { type: 'number', required: true, description: 'First number' },
      b: { type: 'number', required: true, description: 'Second number' },
    },
    handler: async (args) => {
      const a = args.a
      const b = args.b
      return { result: a * b, expression: `${a} × ${b} = ${a * b}` }
    },
  },
})

runCli({ commands })
