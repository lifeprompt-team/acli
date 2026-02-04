# Migration Guide: MCP SDK to ACLI

This guide helps you migrate from the standard MCP TypeScript SDK (`@modelcontextprotocol/sdk`) to ACLI (`@lifeprompt/acli`).

## Why Migrate?

| Aspect | MCP SDK | ACLI |
|--------|---------|------|
| Tool definition | Verbose, manual schema | Concise, auto-inferred |
| Multiple tools | Register one-by-one | Namespace with subcommands |
| Return type | `{ content: [{ type, text }] }` | Plain objects (auto-wrapped) |
| CLI testing | Not supported | Built-in `runCli()` |
| Argument parsing | Manual | CLI-style (`--flag`, positional) |

## Side-by-Side Comparison

### Before: MCP SDK

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

const server = new McpServer({
  name: "math-server",
  version: "1.0.0",
});

// Tool 1: add
server.registerTool(
  "add",
  {
    description: "Add two numbers",
    inputSchema: {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
  },
  async ({ a, b }) => {
    return {
      content: [{ type: "text", text: String(a + b) }],
    };
  }
);

// Tool 2: multiply
server.registerTool(
  "multiply",
  {
    description: "Multiply two numbers",
    inputSchema: {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
  },
  async ({ a, b }) => {
    return {
      content: [{ type: "text", text: String(a * b) }],
    };
  }
);

// ... transport setup, error handling, etc.
```

### After: ACLI

```typescript
import { defineCommand, arg, registerAcli } from "@lifeprompt/acli";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define commands
const add = defineCommand({
  description: "Add two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),
});

const multiply = defineCommand({
  description: "Multiply two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => ({ result: a * b }),
});

// Register as single MCP tool
const server = new McpServer({ name: "math-server", version: "1.0.0" });
registerAcli(server, "math", { add, multiply });

// ... transport setup
```

## Key Differences

### 1. Input Schema

**MCP SDK:**
```typescript
inputSchema: {
  name: z.string().describe("User name"),
  age: z.number().optional().describe("User age"),
}
```

**ACLI:**
```typescript
args: {
  name: arg(z.string(), { positional: 0, description: "User name" }),
  age: arg(z.coerce.number().optional(), { description: "User age" }),
}
```

Key points:
- Use `z.coerce.number()` instead of `z.number()` (CLI args are strings)
- `positional: N` for positional arguments
- Named arguments become `--age 25` in CLI syntax

### 2. Return Values

**MCP SDK:**
```typescript
return {
  content: [
    { type: "text", text: JSON.stringify(result) }
  ]
};
```

**ACLI:**
```typescript
return { result: 42, message: "Done" };
// Automatically wrapped as MCP content
```

### 3. Multiple Tools → Subcommands

**MCP SDK** (3 separate tools):
```typescript
server.registerTool("user_list", ...);
server.registerTool("user_get", ...);
server.registerTool("user_create", ...);
```

**ACLI** (1 tool with subcommands):
```typescript
const user = defineCommand({
  description: "User management",
  subcommands: {
    list: defineCommand({ ... }),
    get: defineCommand({ ... }),
    create: defineCommand({ ... }),
  },
});

registerAcli(server, "user", user);
// AI calls: user list, user get 123, user create --name "John"
```

## Migration Steps

### Step 1: Install ACLI

```bash
npm install @lifeprompt/acli
# or
pnpm add @lifeprompt/acli
```

### Step 2: Convert Tool Definitions

For each `server.registerTool()`:

```typescript
// Before
server.registerTool(
  "tool-name",
  {
    description: "...",
    inputSchema: { field: z.string() }
  },
  async (args) => {
    return { content: [{ type: "text", text: "..." }] };
  }
);

// After
const toolName = defineCommand({
  description: "...",
  args: {
    field: arg(z.string(), { positional: 0, description: "..." }),
  },
  handler: async ({ field }) => {
    return { field }; // Plain object
  },
});
```

### Step 3: Group Related Tools

If you have related tools like `user_list`, `user_get`, `user_create`:

```typescript
const user = defineCommand({
  description: "User management commands",
  subcommands: {
    list: listCommand,
    get: getCommand,
    create: createCommand,
  },
});
```

### Step 4: Register with MCP Server

```typescript
import { registerAcli } from "@lifeprompt/acli";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
registerAcli(server, "mytools", { user, project, ... });
```

### Step 5: Test with CLI (Optional)

```typescript
import { runCli } from "@lifeprompt/acli";

// For development/testing
if (process.argv[2] === "cli") {
  runCli({ commands: { user, project } });
}
```

```bash
npx ts-node server.ts cli user list
npx ts-node server.ts cli user get 123
```

## Common Patterns

### Optional Arguments with Defaults

**MCP SDK:**
```typescript
inputSchema: {
  limit: z.number().default(10).describe("Max results")
}
```

**ACLI:**
```typescript
args: {
  limit: arg(z.coerce.number().default(10), { description: "Max results" }),
}
```

### Boolean Flags

**MCP SDK:**
```typescript
inputSchema: {
  verbose: z.boolean().optional().describe("Enable verbose output")
}
```

**ACLI:**
```typescript
args: {
  verbose: arg(z.boolean().default(false), { alias: "v", description: "Enable verbose output" }),
}
// Usage: mytools command --verbose or mytools command -v
```

### Enum Values

**MCP SDK:**
```typescript
inputSchema: {
  format: z.enum(["json", "csv", "xml"]).describe("Output format")
}
```

**ACLI:**
```typescript
args: {
  format: arg(z.enum(["json", "csv", "xml"]), { description: "Output format" }),
}
// Usage: mytools export --format json
```

## What Doesn't Change

- MCP Server setup (`new McpServer(...)`)
- Transport configuration (stdio, HTTP, SSE)
- Resources and Prompts (ACLI only handles tools)
- Authentication and OAuth

## Gradual Migration

You can migrate gradually - ACLI tools coexist with standard MCP tools:

```typescript
const server = new McpServer({ name: "hybrid-server", version: "1.0.0" });

// Keep existing MCP tool
server.registerTool("legacy-tool", { ... }, async () => { ... });

// Add new ACLI tools
registerAcli(server, "new", { command1, command2 });
```

## FAQ

### Q: Do I need to change my MCP client?

No. ACLI tools appear as standard MCP tools to clients. The AI agent sees a tool with an `input` parameter that accepts CLI-style strings.

### Q: Can I use ACLI with MCP SDK v2?

Yes. ACLI works with both v1.x and v2 of the MCP SDK.

### Q: What about streaming/notifications?

ACLI handlers return plain objects. For advanced MCP features like logging notifications, you can access the MCP server directly alongside ACLI.

### Q: Is there a codemod for automatic migration?

Not currently. The migration is straightforward enough to do manually, and the patterns differ enough that manual review is recommended.
