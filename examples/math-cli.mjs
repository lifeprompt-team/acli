#!/usr/bin/env node
/**
 * Example: math CLI tool using acli
 *
 * Usage (positional args):
 *   node examples/math-cli.mjs add 10 20
 *   node examples/math-cli.mjs multiply 5 7
 *
 * Usage (named args):
 *   node examples/math-cli.mjs add --a 10 --b 20
 *   node examples/math-cli.mjs multiply -a 5 -b 7
 *
 * Help:
 *   node examples/math-cli.mjs help
 */

import { defineCommands, runCli } from '../dist/index.js'

const commands = defineCommands({
  add: {
    description: 'Add two numbers',
    args: {
      a: { type: 'number', required: true, positional: 0, description: 'First number' },
      b: { type: 'number', required: true, positional: 1, description: 'Second number' },
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
      a: { type: 'number', required: true, positional: 0, description: 'First number' },
      b: { type: 'number', required: true, positional: 1, description: 'Second number' },
    },
    handler: async (args) => {
      const a = args.a
      const b = args.b
      return { result: a * b, expression: `${a} × ${b} = ${a * b}` }
    },
  },
})

runCli({ commands })
