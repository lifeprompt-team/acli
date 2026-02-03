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
- **Structured Output**: JSON responses with standardized error codes
- **CLI & MCP Dual Support**: Use as MCP tool or standalone CLI

## Installation

```bash
npm install @lifeprompt/acli
# or
pnpm add @lifeprompt/acli
```

## Quick Start

### MCP Server Integration

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerAcli, defineCommands } from "@lifeprompt/acli"

const commands = defineCommands({
  add: {
    description: "Add two numbers",
    args: {
      a: { type: "number", required: true, positional: 0 },
      b: { type: "number", required: true, positional: 1 },
    },
    handler: async (args) => ({ result: args.a + args.b }),
  },
  multiply: {
    description: "Multiply two numbers",
    args: {
      a: { type: "number", required: true, positional: 0 },
      b: { type: "number", required: true, positional: 1 },
    },
    handler: async (args) => ({ result: args.a * args.b }),
  },
})

const server = new McpServer({ name: "my-server", version: "1.0.0" })

// Register as "math" tool
registerAcli(server, commands, {
  name: "math",
  description: "Mathematical operations.",
})
// → Tool description: "Mathematical operations. Commands: add, multiply. Run 'help' for details."
```

### Standalone CLI

```typescript
#!/usr/bin/env node
import { defineCommands, runCli } from "@lifeprompt/acli"

const commands = defineCommands({
  greet: {
    description: "Say hello",
    args: {
      name: { type: "string", required: true, positional: 0 },
    },
    handler: async (args) => ({ message: `Hello, ${args.name}!` }),
  },
})

runCli({ commands })
```

```bash
node my-cli.mjs greet World
# → { "message": "Hello, World!" }
```

---

## API Reference

### `defineCommands(commands)`

Type-safe command registry builder.

```typescript
const commands = defineCommands({
  commandName: {
    description: "Command description",
    args: { /* ArgumentDefinition */ },
    handler: async (args) => { /* return data */ },
    subcommands: { /* nested commands */ },
  },
})
```

### `registerAcli(server, commands, options)`

Register commands as an MCP tool.

```typescript
registerAcli(server, commands, {
  name: "tool_name",           // MCP tool name
  description: "Base desc.",   // Optional, auto-generates command list
})

// Or with just name (backward compatible)
registerAcli(server, commands, "tool_name")
```

### `runCli({ commands, args? })`

Run as standalone CLI.

```typescript
runCli({ commands })                    // Uses process.argv
runCli({ commands, args: ["add", "1", "2"] })  // Custom args
```

---

## Command Definition

### Structure

```typescript
interface CommandDefinition {
  description: string                              // Required
  args?: Record<string, ArgumentDefinition>        // Optional
  handler?: (args: ParsedArgs) => Promise<unknown> // Optional (required if no subcommands)
  subcommands?: Record<string, CommandDefinition>  // Optional nested commands
}
```

### Example with Subcommands

```typescript
const commands = defineCommands({
  calendar: {
    description: "Calendar management",
    subcommands: {
      events: {
        description: "Manage events",
        subcommands: {
          list: {
            description: "List events",
            args: {
              from: { type: "datetime" },
              limit: { type: "integer", default: 10 },
            },
            handler: async (args) => {
              return { events: await fetchEvents(args) }
            },
          },
          create: {
            description: "Create event",
            args: {
              title: { type: "string", required: true },
              date: { type: "datetime", required: true },
            },
            handler: async (args) => {
              return { event: await createEvent(args) }
            },
          },
        },
      },
    },
  },
})
```

Usage:
```
calendar events list --from 2026-02-01 --limit 5
calendar events create --title "Meeting" --date 2026-02-02T10:00:00Z
```

---

## Argument Types

| Type       | Description                       | Example Value              |
|------------|-----------------------------------|----------------------------|
| `string`   | Text value                        | `"hello"`                  |
| `integer`  | Whole number                      | `42`                       |
| `number`   | Decimal number                    | `3.14`                     |
| `boolean`  | `true` / `false`                  | `true`                     |
| `flag`     | Presence-based boolean            | (no value needed)          |
| `datetime` | ISO8601 date string → `Date`      | `2026-02-02T10:00:00Z`     |
| `array`    | Comma-separated → `string[]`      | `"a,b,c"` → `["a","b","c"]`|

### ArgumentDefinition

```typescript
interface ArgumentDefinition {
  type: ArgumentType          // Required
  description?: string        // Help text
  required?: boolean          // Default: false
  default?: unknown           // Default value
  positional?: number         // Position index (0-based) for positional args
  examples?: string[]         // Example values for help
}
```

---

## Positional Arguments

Positional arguments allow cleaner syntax:

```typescript
const commands = defineCommands({
  add: {
    description: "Add numbers",
    args: {
      a: { type: "number", required: true, positional: 0 },
      b: { type: "number", required: true, positional: 1 },
    },
    handler: async (args) => ({ result: args.a + args.b }),
  },
})
```

Both syntaxes work:
```bash
add 10 20          # Positional
add --a 10 --b 20  # Named
add -a 10 -b 20    # Short
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

### MCP Response Structure

```typescript
interface CallToolResult {
  content: Array<TextContent | ImageContent>
  isError?: boolean
}

interface TextContent {
  type: "text"
  text: string
}

interface ImageContent {
  type: "image"
  data: string      // base64 encoded
  mimeType: string
}
```

### Error Response

Errors are returned with `isError: true` and structured error data:

```typescript
// Error response structure
{
  content: [{ type: "text", text: JSON.stringify({
    error: {
      code: AcliErrorCode,
      message: string,
      hint?: string,
      examples?: string[]
    }
  })}],
  isError: true
}
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

- **No Shell Execution**: Commands are parsed and executed directly in-process. All input is treated as plain text.
- **Command Whitelist**: Only registered commands can be executed
- **Argument Validation**: Type checking before handler execution
- **DoS Prevention**: Length and count limits on commands and arguments

---

## Creating a Wrapper CLI

To create a domain-specific CLI tool (e.g., for Google Ads, AWS, etc.):

```typescript
#!/usr/bin/env node
// google-ads-cli.mjs
import { defineCommands, runCli } from "@lifeprompt/acli"

// Your authentication logic
const auth = await authenticate()

const commands = defineCommands({
  campaigns: {
    description: "Manage campaigns",
    subcommands: {
      list: {
        description: "List campaigns",
        args: {
          status: { type: "string", default: "ENABLED" },
        },
        handler: async (args) => {
          const campaigns = await auth.client.campaigns.list(args.status)
          return { campaigns }
        },
      },
    },
  },
})

runCli({ commands })
```

---

## TypeScript Types

All types are exported for extension:

```typescript
import type {
  // Command types
  CommandDefinition,
  ArgumentDefinition,
  ArgumentType,
  ParsedArgs,
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
```

---

## License

MIT
