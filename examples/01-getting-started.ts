/**
 * Theme 1: Getting Started
 *
 * Learn the minimum code to create a CLI with ACLI.
 *
 * Usage:
 *   npx ts-node examples/01-getting-started.ts add 10 20
 *   npx ts-node examples/01-getting-started.ts multiply 5 7
 *   npx ts-node examples/01-getting-started.ts help
 *   npx ts-node examples/01-getting-started.ts help add
 */

import { z } from "zod";
import { arg, defineCommand, runCli } from "../dist/index.js";

// =============================================================================
// Step 1: Define a command with defineCommand()
// =============================================================================

const add = defineCommand({
  // Description shown in help
  description: "Add two numbers",

  // Arguments with Zod schemas
  args: {
    // positional: 0 means first positional argument
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },

  // Handler receives typed arguments (a: number, b: number)
  handler: async ({ a, b }) => {
    return { result: a + b };
  },
});

const multiply = defineCommand({
  description: "Multiply two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => {
    return { result: a * b };
  },
});

// =============================================================================
// Step 2: Run the CLI with runCli()
// =============================================================================

runCli({
  commands: { add, multiply },
});

// That's it! You now have a CLI with:
// - help command (built-in)
// - schema command (built-in)
// - version command (built-in)
// - Argument validation via Zod
// - Type-safe handlers
