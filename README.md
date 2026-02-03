# ACLI - Agent CLI

[![CI](https://github.com/lifeprompt-team/acli/actions/workflows/ci.yml/badge.svg)](https://github.com/lifeprompt-team/acli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@lifeprompt/acli.svg)](https://www.npmjs.com/package/@lifeprompt/acli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ACLI** (Agent CLI) is a lightweight CLI protocol for AI agents built on top of MCP (Model Context Protocol).

<img width="1376" height="768" alt="image" src="https://github.com/user-attachments/assets/e9733347-eda9-43e0-a1a2-fbecbbb13706" />

## Why ACLI?

Traditional MCP tool definitions require extensive schema for each tool, consuming valuable context window space. ACLI solves this by:

- **Single Tool per Domain**: One MCP tool (e.g., `math`, `calendar`) handles related commands
- **Dynamic Discovery**: Agents learn commands via `help` and `schema`
- **Shell-less Security**: No shell execution, preventing injection attacks
- **Type-safe Arguments**: Zod-based validation with full TypeScript inference
- **CLI & MCP Dual Support**: Use as MCP tool or standalone CLI

## Installation

```bash
npm install @lifeprompt/acli zod
# or
pnpm add @lifeprompt/acli zod
```

## Quick Start

### MCP Server Integration

```typescript
import { z } from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerAcli, defineCommand, arg } from "@lifeprompt/acli"

// Use defineCommand() for full type inference in handlers
const add = defineCommand({
  description: "Add two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0 }),
    b: arg(z.coerce.number(), { positional: 1 }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),  // a, b are inferred as number
})

const multiply = defineCommand({
  description: "Multiply two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0 }),
    b: arg(z.coerce.number(), { positional: 1 }),
  },
  handler: async ({ a, b }) => ({ result: a * b }),
})

const commands = { add, multiply }

const server = new McpServer({ name: "my-server", version: "1.0.0" })

// Register as "math" tool
registerAcli(server, commands, {
  name: "math",
  description: "Mathematical operations.",
})
// → Tool description: "Mathematical operations. Commands: add, multiply. Run 'help' for details."
```

### How AI Agents Call ACLI Tools

Once registered, AI agents (like Claude) call the tool with a `command` string:

```json
// Tool call from AI agent
{
  "name": "math",
  "arguments": {
    "command": "add 10 20"
  }
}

// Response
{
  "content": [{ "type": "text", "text": "{\"result\":30}" }]
}
```

```json
// Discovery - agents can explore available commands
{ "name": "math", "arguments": { "command": "help" } }
{ "name": "math", "arguments": { "command": "help add" } }
{ "name": "math", "arguments": { "command": "schema" } }
```

### Standalone CLI

```typescript
#!/usr/bin/env node
import { z } from "zod"
import { defineCommand, runCli, arg } from "@lifeprompt/acli"

const greet = defineCommand({
  description: "Say hello",
  args: {
    name: arg(z.string(), { positional: 0 }),
  },
  handler: async ({ name }) => ({ message: `Hello, ${name}!` }),  // name is inferred as string
})

runCli({ commands: { greet } })
```

```bash
node my-cli.mjs greet World
# → { "message": "Hello, World!" }
```

---

## Argument Definition

ACLI uses Zod for type-safe argument parsing with rich validation.

### `arg(schema, meta?)`

Wraps a Zod schema with CLI metadata:

```typescript
import { z } from "zod"
import { arg } from "@lifeprompt/acli"

// Basic types
arg(z.string())                           // Required string
arg(z.coerce.number())                    // Number (coerced from string)
arg(z.coerce.number().int())              // Integer
arg(z.boolean().default(false))           // Flag (presence = true)
arg(z.coerce.date())                      // Date (ISO8601 string → Date)

// Validation
arg(z.string().min(1).max(100))           // Length validation
arg(z.coerce.number().min(0).max(100))    // Range validation
arg(z.enum(["json", "csv", "table"]))     // Enum validation
arg(z.string().email())                   // Email validation
arg(z.string().regex(/^[a-z]+$/))         // Regex validation

// Optional & defaults
arg(z.string().optional())                // Optional
arg(z.string().default("hello"))          // With default

// Metadata
arg(z.string(), { positional: 0 })        // Positional argument
arg(z.string(), { description: "Name" })  // Help text
arg(z.string(), { examples: ["foo"] })    // Example values
```

### `InferArgs<T>`

Infers the parsed argument types from an args definition:

```typescript
const myArgs = {
  name: arg(z.string()),
  count: arg(z.coerce.number().default(10)),
  active: arg(z.boolean().optional()),
}

type MyArgs = InferArgs<typeof myArgs>
// { name: string; count: number; active?: boolean }
```

---

## Command Definition

### Structure

```typescript
import { z } from "zod"
import { defineCommand, arg, type InferArgs } from "@lifeprompt/acli"

interface CommandDefinition<TArgs extends ArgsDefinition> {
  description: string                        // Required
  args?: TArgs                               // Zod-based arguments
  handler?: (args: InferArgs<TArgs>) => Promise<unknown>
  subcommands?: CommandRegistry              // Nested commands
}
```

### Example with Subcommands

Use `cmd()` (alias for `defineCommand`) inside subcommands to enable type inference:

```typescript
import { z } from "zod"
import { defineCommand, cmd, arg } from "@lifeprompt/acli"

const calendar = defineCommand({
  description: "Calendar management",
  subcommands: {
    events: cmd({
      description: "Manage events",
      subcommands: {
        list: cmd({
          description: "List events",
          args: {
            from: arg(z.coerce.date().optional()),
            limit: arg(z.coerce.number().int().default(10)),
          },
          handler: async ({ from, limit }) => {
            // from: Date | undefined, limit: number (types inferred!)
            return { events: await fetchEvents({ from, limit }) }
          },
        }),
        create: cmd({
          description: "Create event",
          args: {
            title: arg(z.string().min(1)),
            date: arg(z.coerce.date()),
          },
          handler: async ({ title, date }) => {
            // title: string, date: Date (types inferred!)
            return { event: await createEvent({ title, date }) }
          },
        }),
      },
    }),
  },
})

// Use directly: registerAcli(server, { calendar }, { name: "cli" })
```

> **Note**: Without `cmd()`, inline subcommand handlers receive `unknown` types due to TypeScript's type inference limitations. Always wrap subcommands with `cmd()` for full type safety.

Usage:
```
calendar events list --from 2026-02-01 --limit 5
calendar events create --title "Meeting" --date 2026-02-02T10:00:00Z
```

---

## Positional Arguments

Positional arguments allow cleaner syntax:

```typescript
const add = defineCommand({
  description: "Add numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0 }),
    b: arg(z.coerce.number(), { positional: 1 }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),
})

// Use: registerAcli(server, { add }, { name: "math" })
```

All syntaxes work:
```bash
add 10 20          # Positional
add --a 10 --b 20  # Named
add -a 10 -b 20    # Short (first letter)
```

---

## Built-in Commands

These commands are automatically available:

| Command    | Description                          |
|------------|--------------------------------------|
| `help`     | List all commands                    |
| `help <cmd>` | Show command details               |
| `schema`   | JSON schema for all commands         |
| `schema <cmd>` | JSON schema for specific command |
| `version`  | Show ACLI version                    |

---

## Response Format

ACLI uses MCP-native response format for seamless integration.

### Handler Return Values

Handlers can return values in two ways:

```typescript
// 1. Simple object (auto-wrapped to MCP format)
handler: async () => ({ result: 123 })
// → { content: [{ type: "text", text: '{"result":123}' }] }

// 2. MCP native format (passed through as-is)
handler: async () => ({
  content: [
    { type: "text", text: "Hello" },
    { type: "image", data: "base64...", mimeType: "image/png" },
  ]
})
// → passed through unchanged
```

### Error Codes

| Code               | Description                              |
|--------------------|------------------------------------------|
| `COMMAND_NOT_FOUND`| Command does not exist                   |
| `VALIDATION_ERROR` | Invalid arguments or missing required    |
| `EXECUTION_ERROR`  | Handler threw an error                   |
| `PARSE_ERROR`      | Malformed command string                 |
| `PERMISSION_DENIED`| Authorization failed                     |

---

## Security

ACLI is designed with security in mind:

- **No Shell Execution**: Commands are parsed and executed directly in-process
- **Command Whitelist**: Only registered commands can be executed
- **Argument Validation**: Zod validation before handler execution
- **DoS Prevention**: Length and count limits on commands and arguments

---

## API Reference

### `registerAcli(server, commands, options)`

Register commands as an MCP tool.

```typescript
registerAcli(server, commands, {
  name: "tool_name",           // MCP tool name
  description: "Base desc.",   // Optional, auto-generates command list
})

// Or with just name
registerAcli(server, commands, "tool_name")
```

### `runCli({ commands, args? })`

Run as standalone CLI.

```typescript
runCli({ commands })                          // Uses process.argv
runCli({ commands, args: ["add", "1", "2"] }) // Custom args
```

### `createAcli(commands)`

Create a tool definition for manual integration.

```typescript
const tool = createAcli(commands)
const result = await tool.execute({ command: "add 1 2" })
```

---

## TypeScript Types

All types are exported:

```typescript
import type {
  // Argument types
  ArgSchema,
  ArgMeta,
  ArgsDefinition,
  InferArgs,
  // Command types
  CommandDefinition,
  CommandRegistry,
  // MCP response types
  CallToolResult,
  TextContent,
  ImageContent,
  // Error types
  AcliError,
  AcliErrorCode,
  // Options
  AcliToolOptions,
  CliOptions,
} from "@lifeprompt/acli"

// Helper functions
import { arg, defineCommand, cmd } from "@lifeprompt/acli"
// cmd is an alias for defineCommand - use inside subcommands for type inference
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, release flow, and guidelines.

---

## License

MIT
