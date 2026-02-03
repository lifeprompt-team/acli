import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { arg, defineCommand } from '../router/registry'

describe('type inference with defineCommand', () => {
  it('infers handler args correctly', async () => {
    const add = defineCommand({
      description: 'Add two numbers',
      args: {
        a: arg(z.coerce.number()),
        b: arg(z.coerce.number()),
      },
      handler: async (args) => {
        // TypeScript infers args.a and args.b as number
        const result: number = args.a + args.b
        return { result }
      },
    })

    expect(add.description).toBe('Add two numbers')
  })

  it('works with optional and default values', async () => {
    const search = defineCommand({
      description: 'Search',
      args: {
        query: arg(z.string()),
        limit: arg(z.coerce.number().default(10)),
        verbose: arg(z.boolean().optional()),
      },
      handler: async (args) => {
        // query: string, limit: number, verbose: boolean | undefined
        return { query: args.query, limit: args.limit }
      },
    })

    expect(search.description).toBe('Search')
  })

  it('can be combined into CommandRegistry', async () => {
    const add = defineCommand({
      description: 'Add',
      args: { a: arg(z.coerce.number()), b: arg(z.coerce.number()) },
      handler: async ({ a, b }) => ({ result: a + b }),
    })

    const multiply = defineCommand({
      description: 'Multiply',
      args: { a: arg(z.coerce.number()), b: arg(z.coerce.number()) },
      handler: async ({ a, b }) => ({ result: a * b }),
    })

    // Commands can be grouped as a plain object
    const commands = { add, multiply }
    expect(commands.add.description).toBe('Add')
    expect(commands.multiply.description).toBe('Multiply')
  })
})
