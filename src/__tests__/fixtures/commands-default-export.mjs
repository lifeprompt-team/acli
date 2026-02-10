// Pattern 1: Default export as CommandRegistry
const add = {
  description: 'Add two numbers',
  args: {},
  handler: async () => ({ result: 3 }),
}

const multiply = {
  description: 'Multiply two numbers',
  args: {},
  handler: async () => ({ result: 6 }),
}

export default { add, multiply }
