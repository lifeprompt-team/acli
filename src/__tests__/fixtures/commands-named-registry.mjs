// Pattern 2: Named 'commands' export
export const commands = {
  add: {
    description: 'Add two numbers',
    args: {},
    handler: async () => ({ result: 3 }),
  },
  subtract: {
    description: 'Subtract two numbers',
    args: {},
    handler: async () => ({ result: 1 }),
  },
}
