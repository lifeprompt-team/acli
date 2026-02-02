# ACLI Architecture

This document describes the internal architecture and design philosophy of ACLI.

## Design Philosophy

### 1. Context Efficiency for AI Agents

Traditional MCP requires each tool to have a complete JSON Schema definition. For complex systems with many operations, this consumes significant context window space.

**ACLI's approach:**
- One MCP tool per domain (e.g., `calendar`, `math`, `google_ads`)
- Commands are discovered dynamically via `help` command
- Detailed schemas available on-demand via `schema` command

### 2. Shell-less Security

Unlike traditional CLIs that invoke shell commands, ACLI parses and executes commands directly in-process. All input is treated as plain text strings.

**Security measures:**
- No shell invocation - all characters are treated as literal text
- Type validation before handler execution
- Command whitelist (only registered commands)
- DoS prevention via length/count limits

### 3. Dual Interface

ACLI works both as:
- **MCP Tool**: Registered with MCP server for AI agent access
- **CLI Binary**: Executable from terminal for human use

---

## Module Structure

```
src/
├── index.ts           # Public API exports
├── cli.ts             # CLI runner (standalone execution)
├── mcp/
│   └── tool.ts        # MCP integration (registerAcli)
├── parser/
│   ├── tokenizer.ts   # Command string → tokens
│   └── args.ts        # Tokens → parsed arguments
├── router/
│   └── registry.ts    # Command definitions & routing
├── response/
│   └── types.ts       # Response types & helpers
└── discovery/
    └── index.ts       # help, schema, version commands
```

---

## Data Flow

```
Input: "calendar events --today"
         │
         ▼
┌─────────────────┐
│   Tokenizer     │  Split into tokens, security check
│   tokenizer.ts  │  → ["calendar", "events", "--today"]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Command Router │  Find command definition
│   registry.ts   │  → CommandDefinition for "calendar events"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Arg Parser     │  Parse arguments by definition
│    args.ts      │  → { today: true }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Handler      │  Execute command handler
│  (user-defined) │  → { events: [...] }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Response      │  Wrap in standard response
│   types.ts      │  → { success: true, data: {...} }
└─────────────────┘
```

---

## Key Components

### Tokenizer (`src/parser/tokenizer.ts`)

Converts command string to token array with security checks.

```typescript
tokenize("calendar events --today")
// → { ok: true, value: ["calendar", "events", "--today"] }

tokenize("events; rm -rf /")
// → { ok: true, value: ["events;", "rm", "-rf", "/"] }
// Note: All characters are treated as plain text (no shell execution)
```

**Features:**
- POSIX-style quoting (`"hello world"`, `'single'`)
- Backslash escape support
- Whitespace normalization

### Command Registry (`src/router/registry.ts`)

Defines command structure and routing.

```typescript
interface CommandDefinition {
  description: string
  args?: Record<string, ArgumentDefinition>
  handler?: (args: ParsedArgs) => Promise<unknown>
  subcommands?: Record<string, CommandDefinition>
}
```

**Key functions:**
- `defineCommands()`: Type-safe registry builder
- `findCommand()`: Route tokens to command definition
- `extractCommandPath()`: Separate command path from arguments
- `listCommands()`: Enumerate all commands (for help)

### Argument Parser (`src/parser/args.ts`)

Parses tokens into typed arguments.

**Supported patterns:**
- Long options: `--name value`, `--name=value`
- Short options: `-n value`
- Positional: `value1 value2` (when `positional` is defined)
- Flags: `--verbose` (no value)

### MCP Integration (`src/mcp/tool.ts`)

Registers ACLI as an MCP tool.

```typescript
registerAcli(server, commands, {
  name: "math",
  description: "Mathematical operations.",
})
```

**Auto-generated description:**
```
"Mathematical operations. Commands: add, multiply. Run 'help' for details."
```

### CLI Runner (`src/cli.ts`)

Standalone CLI execution.

```typescript
runCli({ commands })
// Reads process.argv, executes, prints JSON, exits
```

---

## Extension Points

### Adding a New Argument Type

1. Add type to `ArgumentType` in `registry.ts`
2. Add parsing logic to `parseValue()` in `args.ts`

### Adding a New Built-in Command

1. Add handler in `discovery/index.ts`
2. Add routing in `mcp/tool.ts` or `cli.ts`

### Creating a Domain Wrapper

See `examples/math-cli.mjs` for a complete example.

1. Import `defineCommands` and `runCli` (or `registerAcli`)
2. Define commands with handlers
3. Call `runCli({ commands })` or `registerAcli(server, commands, options)`

---

## Error Handling

All errors return structured `AcliErrorResponse`:

```typescript
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",  // Machine-readable
    message: "Invalid date",   // Human-readable
    hint: "Use ISO8601",       // Suggestion
    examples: ["--date 2026-01-01"]
  }
}
```

### Error Codes

| Code | When |
|------|------|
| `COMMAND_NOT_FOUND` | Unknown command |
| `VALIDATION_ERROR` | Argument validation failed |
| `EXECUTION_ERROR` | Handler threw |
| `PARSE_ERROR` | Malformed input (unclosed quotes, etc.) |
| `PERMISSION_DENIED` | Auth failed |

---

## Testing

Tests are in `src/__tests__/`:

| File | Coverage |
|------|----------|
| `tokenizer.test.ts` | Tokenization, security |
| `args.test.ts` | Argument parsing, types |
| `registry.test.ts` | Command routing |
| `tool.test.ts` | MCP integration |

Run with:
```bash
pnpm test:run
```

---

## Future Considerations

- **Streaming responses**: For long-running commands
- **Authentication middleware**: Common auth patterns
- **Command aliases**: Shorthand commands
- **Tab completion**: Shell integration
- **Validation plugins**: Custom validators
