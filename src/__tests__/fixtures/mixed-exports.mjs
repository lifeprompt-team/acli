// Mix of commands and non-command exports
export const API_VERSION = '2.0'

export const add = {
  description: 'Add two numbers',
  args: {},
  handler: async () => ({ result: 3 }),
}

export const helperFn = () => 'not a command'

export const greet = {
  description: 'Say hello',
  args: {},
  handler: async () => ({ message: 'Hello!' }),
}
