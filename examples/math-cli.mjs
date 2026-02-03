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

import { z } from 'zod'
import { arg, defineCommand, runCli } from '../dist/index.js'

const add = defineCommand({
  description: 'Add two numbers',
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: 'First number' }),
    b: arg(z.coerce.number(), { positional: 1, description: 'Second number' }),
  },
  handler: async ({ a, b }) => {
    return { result: a + b, expression: `${a} + ${b} = ${a + b}` }
  },
})

const multiply = defineCommand({
  description: 'Multiply two numbers',
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: 'First number' }),
    b: arg(z.coerce.number(), { positional: 1, description: 'Second number' }),
  },
  handler: async ({ a, b }) => {
    return { result: a * b, expression: `${a} × ${b} = ${a * b}` }
  },
})

runCli({ commands: { add, multiply } })
