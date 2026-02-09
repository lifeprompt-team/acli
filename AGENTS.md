# AGENTS.md - Guide for Coding Agents

This document helps coding agents (Cursor, Copilot, Claude, etc.) understand how to build ACLI tools effectively.

---

## What is ACLI?

**ACLI (Agent CLI)** is a CLI-style interface protocol for MCP tools, designed for AI agents.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Context Efficiency** | One MCP tool definition serves multiple commands. Saves AI context window. |
| **Shell-less** | No shell execution. Prevents injection attacks by design. |
| **Type Safety** | Zod-based validation with full TypeScript inference in handlers. |
| **Dynamic Discovery** | AI agents discover capabilities via `help` and `schema` commands. |

### How It Works

```
Traditional MCP:
  tool1 (schema) + tool2 (schema) + tool3 (schema) + ...
  → More tools = more context consumption

ACLI:
  One tool (command: string) → Internal routing
  → Context efficient
```

---

## Quick Reference

### Define a Command

```typescript
import { z } from "zod";
import { arg, defineCommand } from "@lifeprompt/acli";

const add = defineCommand({
  description: "Add two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0, description: "First number" }),
    b: arg(z.coerce.number(), { positional: 1, description: "Second number" }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),
});
```

### Define Subcommands

Use `cmd()` (alias for `defineCommand`) for cleaner nested definitions:

```typescript
import { arg, cmd, defineCommand } from "@lifeprompt/acli";

const user = defineCommand({
  description: "User management",
  subcommands: {
    list: cmd({
      description: "List users",
      args: {},
      handler: async () => ({ users: [...] }),
    }),
    create: cmd({
      description: "Create user",
      args: {
        name: arg(z.string(), { positional: 0 }),
        email: arg(z.string().email()),
      },
      handler: async ({ name, email }) => ({ created: { name, email } }),
    }),
  },
});
```

### Register with MCP Server

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAcli } from "@lifeprompt/acli";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

// Single pattern: One domain = One tool
registerAcli(server, "math", { add, subtract, multiply });
// AI calls: { "name": "math", "arguments": { "command": "add 10 20" } }

// Composite pattern: Multiple domains in one tool
registerAcli(server, "acli", { math, time, echo }, "Agent CLI with multiple namespaces.");
// AI calls: { "name": "acli", "arguments": { "command": "math add 10 20" } }
```

---

## Argument Patterns

```typescript
args: {
  // Positional (first argument)
  name: arg(z.string(), { positional: 0 }),

  // Positional (second argument)
  value: arg(z.coerce.number(), { positional: 1 }),

  // Named with default
  limit: arg(z.coerce.number().default(10)),

  // Enum
  format: arg(z.enum(["json", "csv"]).default("json")),

  // Boolean flag (--verbose or -v)
  verbose: arg(z.boolean().default(false), { short: 'v' }),

  // Optional
  filter: arg(z.string().optional()),

  // Date (ISO8601 string → Date)
  date: arg(z.coerce.date()),

  // Short alias with value (-H "Bearer token")
  header: arg(z.string(), { short: 'H' }),

  // Array (repeated option: --tag a --tag b → ["a", "b"])
  tag: arg(z.array(z.string())),
}
```

**Auto-coercion:** CLI arguments are always strings. The parser automatically converts string values to the expected type before Zod validation. `z.number()`, `z.date()`, `z.bigint()`, and their wrapped forms (`.optional()`, `.default()`, `.refine()`, `.transform()`) all work without needing `z.coerce.*`:
```typescript
arg(z.number())                     // ✅ "42" → 42
arg(z.number().int().min(0))        // ✅ checks preserved
arg(z.number().refine(n => n > 0))  // ✅ works through .refine()
arg(z.array(z.number()))            // ✅ array elements converted too
```

**Combined short options:** Short boolean flags can be stacked, and a value-taking option can appear at the end:
```
command -abc           # -a -b -c (all boolean flags)
command -vH value      # -v (flag) + -H value
command -vHvalue       # same as above (attached value)
command -H=value       # equals-separated value
```

**Note:** Use `--` to pass values that start with dashes as positional arguments:
```
echo -- --not-a-flag   # "--not-a-flag" is treated as a positional value
```

**Note:** Use `--no-` prefix to negate boolean flags:
```
command --no-verbose    # verbose = false
command --no-color      # color = false
```

---

## Writing Good Descriptions

AI agents read descriptions to understand tools. Write them thoroughly.

### Tool-Level Description

```typescript
registerAcli(server, "bq", commands, `Google BigQuery operations.

Commands: query, datasets, tables, schema

Quick Examples:
  datasets                    # List datasets
  tables my_dataset           # List tables
  query "SELECT * FROM t"     # Execute SQL

Use 'help' for detailed command information.`);
```

### Command-Level Description

For complex commands, include:
- **Usage** - Copy-paste ready examples
- **Key Information** - Tables, columns, options
- **Common Patterns** - Frequently used combinations
- **Tips/Warnings** - Gotchas, limitations
- **Restrictions** - What's not allowed

```typescript
const query = defineCommand({
  description: `Execute SQL query on BigQuery.

Usage:
  query "SELECT * FROM dataset.table LIMIT 10"
  query --max 500 "SELECT * FROM dataset.table"

Key Tables:
  • sales_data: Revenue, profit (~70K rows)
  • customers: Customer info (~10K rows)

Common Patterns:
  # Monthly trend
  query "SELECT FORMAT_DATE('%Y-%m', date) as month, SUM(amount) FROM sales GROUP BY month"

Tips:
  - Always use dataset.table format
  - Cast strings: CAST(col AS FLOAT64)

Restrictions:
  - SELECT only (no INSERT/UPDATE/DELETE)
  - Max 1000 rows`,
  args: { ... },
  handler: async (...) => { ... },
});
```

---

## Common Mistakes

### Default values and TypeScript

```typescript
// ❌ Problem: limit is number | undefined in handler
args: {
  limit: arg(z.coerce.number().default(10)),
}
handler: async ({ limit }) => { ... }

// ✅ Solution: Add default in destructuring
handler: async ({ limit = 10 }) => { ... }
```

### Minimal descriptions

```typescript
// ❌ AI doesn't know how to use this
description: "Execute query"

// ✅ AI can use this effectively
description: `Execute SQL query.

Usage:
  query "SELECT * FROM table LIMIT 10"

Available Tables:
  • users (id, name, email)
  • orders (id, user_id, amount)`
```

### Unhelpful errors

```typescript
// ❌ AI can't self-correct
throw new Error("Invalid input");

// ✅ AI can self-correct
throw new Error(
  "Invalid date format. Use ISO8601 (YYYY-MM-DD). Example: --date 2026-02-04"
);
```

---

## File Structure

### Recommended Layout

```
src/tools/
├── my-tool/
│   └── index.ts        # Commands + registerXxxTools function
├── another-tool/
│   └── index.ts
└── index.ts            # Export all tools
```

### Tool File Template

```typescript
// src/tools/my-tool/index.ts

import { arg, cmd, defineCommand, registerAcli } from "@lifeprompt/acli";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ============================================================
// Commands
// ============================================================

const list = defineCommand({
  description: "...",
  args: { ... },
  handler: async (...) => { ... },
});

const create = defineCommand({
  description: "...",
  args: { ... },
  handler: async (...) => { ... },
});

// ============================================================
// MCP Registration
// ============================================================

export function registerMyTools(mcp: McpServer) {
  registerAcli(mcp, "my-tool", { list, create }, "...");
}
```

---

## Checklist

When building ACLI tools:

### Command Definition
- [ ] Use `defineCommand` for commands
- [ ] Use `cmd()` for subcommands
- [ ] Add `description` to all arguments
- [ ] Set `positional: N` for positional arguments
- [ ] Add default in handler destructuring for default-valued args

### Descriptions
- [ ] Tool description lists available commands
- [ ] Each command has usage examples
- [ ] Complex commands have key info / common patterns
- [ ] Restrictions and tips are documented

### MCP Registration
- [ ] Use `registerAcli` to register
- [ ] Tool name is short and clear
- [ ] Single vs Composite pattern chosen appropriately

### Error Handling
- [ ] Error messages include how to fix
- [ ] Examples included for format errors

---

## Compatibility

### Zod

ACLI supports **Zod v3 (^3.23.0)** and is designed to be forward-compatible with **Zod v4**.

- The parser uses only `instanceof` checks and public API methods (`.unwrap()`, `.removeDefault()`, `.element`, `.innerType()`) — no internal `_def` access.
- Both `z.number()` and `z.coerce.number()` work. The parser handles string-to-type conversion automatically.

### MCP SDK

ACLI requires `@modelcontextprotocol/sdk ^1.0.0` as an optional peer dependency. When used with MCP SDK v1.25+, Zod `^3.25` is required by the SDK.

### Agent SDKs

As of February 2026, most Agent SDKs have migrated to Zod v4:

| SDK | Zod requirement |
|-----|----------------|
| `@anthropic-ai/claude-agent-sdk` | `^4.0.0` |
| `@openai/agents` | `^4` |
| `ai` (Vercel AI SDK) | `^3.25.76 \|\| ^4.1.8` |

---

## Resources

- [Examples](https://github.com/lifeprompt-team/acli/tree/main/examples) - Runnable examples
- [Architecture](https://github.com/lifeprompt-team/acli/blob/main/docs/ARCHITECTURE.md) - Internal design
- [Specification](https://github.com/lifeprompt-team/acli/blob/main/docs/SPEC.md) - Protocol specification
- [Changelog](https://github.com/lifeprompt-team/acli/blob/main/CHANGELOG.md) - Version history
