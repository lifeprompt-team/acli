/**
 * Theme 6: Interactive REPL
 *
 * Export commands from a file and explore them interactively.
 *
 * Usage:
 *   # Interactive REPL
 *   npx acli repl examples/06-repl.ts
 *
 *   # Single command execution
 *   npx acli exec examples/06-repl.ts "add 10 20"
 *   npx acli exec examples/06-repl.ts "greet Alice --shout"
 *   npx acli exec examples/06-repl.ts "help"
 *
 * Note: Install jiti for TypeScript support: npm install -D jiti
 */

import { z } from "zod";
import { arg, cmd, defineCommand } from "../dist/index.js";

// =============================================================================
// Commands — just export them, no runCli() needed!
// =============================================================================

export const add = defineCommand({
  description: `Add two numbers.

Usage:
  add 1 2
  add 100 -50`,
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number. Example: 1" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number. Example: 2" }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),
});

export const subtract = defineCommand({
  description: `Subtract two numbers.

Usage:
  subtract 100 42
  subtract 0 10`,
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number. Example: 100" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number. Example: 42" }),
  },
  handler: async ({ a, b }) => ({ result: a - b }),
});

export const greet = defineCommand({
  description: `Greet someone.

Usage:
  greet Alice               Say hello to Alice
  greet Alice --shout       HELLO, ALICE!
  greet "John Doe" --shout  HELLO, JOHN DOE!`,
  args: {
    name: arg(z.string(), { positional: 0, description: "Name to greet. Example: Alice" }),
    shout: arg(z.boolean().default(false), { description: "Uppercase the greeting. Example: --shout" }),
  },
  handler: async ({ name, shout = false }) => {
    const message = `Hello, ${name}!`;
    return { message: shout ? message.toUpperCase() : message };
  },
});

export const math = defineCommand({
  description: `Math operations with subcommands.

Usage:
  math add 1 2
  math multiply 3 4`,
  subcommands: {
    add: cmd({
      description: "Add numbers",
      args: {
        a: arg(z.coerce.number(), { positional: 0, description: "First number. Example: 1" }),
        b: arg(z.coerce.number(), { positional: 1, description: "Second number. Example: 2" }),
      },
      handler: async ({ a, b }) => ({ result: a + b }),
    }),
    multiply: cmd({
      description: "Multiply numbers",
      args: {
        a: arg(z.coerce.number(), { positional: 0, description: "First number. Example: 3" }),
        b: arg(z.coerce.number(), { positional: 1, description: "Second number. Example: 4" }),
      },
      handler: async ({ a, b }) => ({ result: a * b }),
    }),
  },
});
