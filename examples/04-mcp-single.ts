/**
 * Theme 4: MCP Integration (Single Domain)
 *
 * Learn how to register ACLI with MCP Server.
 * Pattern: One domain = One MCP tool
 *
 * Usage:
 *   npx ts-node examples/04-mcp-single.ts
 *
 * Claude Desktop config (~/.config/claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "math": {
 *         "command": "npx",
 *         "args": ["ts-node", "/path/to/acli/examples/04-mcp-single.ts"]
 *       }
 *     }
 *   }
 *
 * Claude will call:
 *   { "name": "math", "arguments": { "command": "add 10 20" } }
 *   { "name": "math", "arguments": { "command": "help" } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { arg, defineCommand, registerAcli } from "../dist/index.js";

// =============================================================================
// Define Commands (same as Theme 1)
// =============================================================================

const add = defineCommand({
  description: "Add two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),
});

const subtract = defineCommand({
  description: "Subtract two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => ({ result: a - b }),
});

const multiply = defineCommand({
  description: "Multiply two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => ({ result: a * b }),
});

const divide = defineCommand({
  description: "Divide two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "Dividend" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Divisor" }),
  },
  handler: async ({ a, b }) => {
    if (b === 0) throw new Error("Division by zero");
    return { result: a / b };
  },
});

// =============================================================================
// Register with MCP Server
// =============================================================================

async function main() {
  const server = new McpServer({
    name: "math-server",
    version: "1.0.0",
  });

  // Register as "math" tool
  // Claude will call: { "name": "math", "arguments": { "command": "add 10 20" } }
  registerAcli(
    server,
    "math",
    { add, subtract, multiply, divide },
    "Mathematical operations.",
  );

  // Connect via stdio (standard for MCP)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Math MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
