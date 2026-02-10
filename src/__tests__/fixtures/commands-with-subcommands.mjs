// Command with subcommands (no handler on parent)
export const math = {
  description: 'Math operations',
  subcommands: {
    add: {
      description: 'Add numbers',
      args: {},
      handler: async () => ({ result: 3 }),
    },
  },
}
