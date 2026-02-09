/**
 * Theme 5: MCP Integration (Composite)
 *
 * Learn multiple namespaces in one MCP tool.
 * Pattern: One tool with multiple domains
 *
 * Usage:
 *   npx ts-node examples/05-mcp-composite.ts
 *
 * Claude Desktop config (~/.config/claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "acli": {
 *         "command": "npx",
 *         "args": ["ts-node", "/path/to/acli/examples/05-mcp-composite.ts"]
 *       }
 *     }
 *   }
 *
 * Claude will call:
 *   { "name": "acli", "arguments": { "command": "math add 10 20" } }
 *   { "name": "acli", "arguments": { "command": "time now --format human" } }
 *   { "name": "acli", "arguments": { "command": "echo hello --uppercase" } }
 *   { "name": "acli", "arguments": { "command": "help" } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { arg, cmd, defineCommand, registerAcli } from "../dist/index.js";

// =============================================================================
// Namespace: math
// =============================================================================

const math = defineCommand({
  description: "Mathematical operations",
  subcommands: {
    add: cmd({
      description: "Add two numbers",
      args: {
        a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
        b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
      },
      handler: async ({ a, b }) => ({ result: a + b }),
    }),
    subtract: cmd({
      description: "Subtract two numbers",
      args: {
        a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
        b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
      },
      handler: async ({ a, b }) => ({ result: a - b }),
    }),
    multiply: cmd({
      description: "Multiply two numbers",
      args: {
        a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
        b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
      },
      handler: async ({ a, b }) => ({ result: a * b }),
    }),
  },
});

// =============================================================================
// Namespace: time
// =============================================================================

const time = defineCommand({
  description: "Time utilities",
  subcommands: {
    now: cmd({
      description: "Get current time",
      args: {
        format: arg(z.enum(["iso", "unix", "human"]).default("iso"), {
          description: "Output format",
        }),
      },
      handler: async ({ format }) => {
        const now = new Date();
        switch (format) {
          case "unix":
            return { timestamp: Math.floor(now.getTime() / 1000) };
          case "human":
            return { time: now.toLocaleString("en-US", { timeZone: "UTC" }) };
          default:
            return { iso: now.toISOString() };
        }
      },
    }),
    diff: cmd({
      description: "Calculate time difference",
      args: {
        from: arg(z.string(), { positional: 0, description: "Start date (ISO)" }),
        to: arg(z.string(), { positional: 1, description: "End date (ISO)" }),
      },
      handler: async ({ from, to }) => {
        const diffMs = new Date(to).getTime() - new Date(from).getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return { days, hours, totalMs: diffMs };
      },
    }),
  },
});

// =============================================================================
// Namespace: echo (simple command without subcommands)
// =============================================================================

const echo = defineCommand({
  description: "Echo back the input",
  args: {
    message: arg(z.string(), { positional: 0, description: "Message to echo" }),
    uppercase: arg(z.boolean().default(false), { description: "Convert to uppercase" }),
  },
  handler: async ({ message, uppercase }) => {
    return { echoed: uppercase ? message.toUpperCase() : message };
  },
});

// =============================================================================
// Register with MCP Server (Composite)
// =============================================================================

async function main() {
  const server = new McpServer({
    name: "acli-composite-server",
    version: "1.0.0",
  });

  // Register as "acli" tool with multiple namespaces
  // Claude will call: { "name": "acli", "arguments": { "command": "math add 10 20" } }
  registerAcli(
    server,
    "acli",
    { math, time, echo },
    "Agent CLI with multiple namespaces (math, time, echo).",
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Composite ACLI Server running on stdio");
  console.error("Available namespaces: math, time, echo");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
