// Pattern 3: Individual named exports
export const add = {
  description: 'Add two numbers',
  args: {},
  handler: async () => ({ result: 3 }),
}

export const greet = {
  description: 'Say hello',
  args: {},
  handler: async () => ({ message: 'Hello!' }),
}
