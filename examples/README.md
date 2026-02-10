# ACLI Examples

ACLI is a **CLI-style interface for MCP tools**. AI agents call MCP tools using familiar CLI syntax.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AI Agent (Claude)                                                       │
│                                                                          │
│  "Calculate 10 + 20"                                                     │
│         │                                                                │
│         ▼                                                                │
│  Tool call: { "name": "math", "arguments": { "command": "add 10 20" } } │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP Server with ACLI                                                    │
│                                                                          │
│  registerAcli(server, "math", { add, multiply })                        │
│         │                                                                │
│         ▼                                                                │
│  Parse "add 10 20" → Execute handler → Return { result: 30 }            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

```bash
pnpm install
pnpm build
```

---

## Theme 1: Define Commands

**File:** [01-getting-started.ts](./01-getting-started.ts)

**What you'll learn:**
- `defineCommand()` to define a command
- `arg()` to define arguments with Zod schemas
- Type-safe handlers

```typescript
const add = defineCommand({
  description: "Add two numbers",
  args: {
    a: arg(z.coerce.number(), { positional: 0 }),
    b: arg(z.coerce.number(), { positional: 1 }),
  },
  handler: async ({ a, b }) => ({ result: a + b }),  // a, b are typed as number
});
```

**Test locally:**
```bash
npx ts-node examples/01-getting-started.ts add 10 20
```

---

## Theme 2: Register as MCP Tool

**File:** [04-mcp-single.ts](./04-mcp-single.ts)

**What you'll learn:**
- `registerAcli()` to expose commands as an MCP tool
- One domain = one tool (e.g., `math`)

```typescript
const server = new McpServer({ name: "math-server", version: "1.0.0" });

registerAcli(server, "math", { add, subtract, multiply, divide }, "Mathematical operations.");
```

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": ["ts-node", "/path/to/examples/04-mcp-single.ts"]
    }
  }
}
```

**How Claude calls it:**
```json
{ "name": "math", "arguments": { "command": "add 10 20" } }
{ "name": "math", "arguments": { "command": "help" } }
{ "name": "math", "arguments": { "command": "multiply 5 7" } }
```

---

## Theme 3: Argument Patterns

**File:** [02-argument-types.ts](./02-argument-types.ts)

**What you'll learn:**
- Positional: `greet Alice` (first arg)
- Named: `--limit 10`
- Flags: `--verbose` (boolean)
- Enums: `--format json|csv|table`
- Optional & defaults

**AI agent calls:**
```json
{ "command": "greet Alice --shout" }
{ "command": "search 'query' --limit 5 --format json" }
```

---

## Theme 4: Subcommands

**File:** [03-subcommands.ts](./03-subcommands.ts)

**What you'll learn:**
- Hierarchical structure with `cmd()`
- `user list`, `user create`, `project list`

```typescript
const user = defineCommand({
  description: "User management",
  subcommands: {
    list: cmd({ ... }),
    create: cmd({ ... }),
    delete: cmd({ ... }),
  },
});
```

**AI agent calls:**
```json
{ "command": "user list" }
{ "command": "user create alice --email alice@example.com" }
{ "command": "help user" }
```

---

## Theme 5: Composite (Multiple Namespaces)

**File:** [05-mcp-composite.ts](./05-mcp-composite.ts)

**What you'll learn:**
- Multiple domains in one tool
- `acli math add 1 2`, `acli time now`, `acli echo hello`

```typescript
registerAcli(server, "acli", { math, time, echo }, "Agent CLI with multiple namespaces.");
```

**AI agent calls:**
```json
{ "name": "acli", "arguments": { "command": "math add 10 20" } }
{ "name": "acli", "arguments": { "command": "time now --format human" } }
{ "name": "acli", "arguments": { "command": "echo hello --uppercase" } }
```

---

## Single vs Composite

| Pattern | Tool Definition | AI Agent Calls |
|---------|-----------------|----------------|
| **Single** | `registerAcli(server, "math", cmds)` | `math add 1 2` |
| **Composite** | `registerAcli(server, "acli", { math, time })` | `acli math add 1 2` |

**Choose Single when:**
- One focused domain (math, calendar)
- Minimal context tokens

**Choose Composite when:**
- Multiple related domains under one tool
- Unified interface for agents

---

## Theme 6: Interactive REPL

**File:** [06-repl.ts](./06-repl.ts)

**What you'll learn:**
- Export commands from a file (no `runCli()` or MCP server needed)
- Interactive REPL with tab completion
- Single command execution with `exec`

**The key difference:** Instead of calling `runCli()` or `registerAcli()`, just export your commands. The REPL loads them automatically.

```typescript
// Just export — that's it!
export const add = defineCommand({ ... })
export const greet = defineCommand({ ... })
export const math = defineCommand({ subcommands: { ... } })
```

**Start REPL:**
```bash
npx @lifeprompt/acli repl examples/06-repl.ts
```

**Session example:**
```
acli> help
acli> add 10 20
acli> greet Alice --shout
acli> math multiply 3 4
acli> exit
```

**Single command execution:**
```bash
npx @lifeprompt/acli exec examples/06-repl.ts "add 10 20"
npx @lifeprompt/acli exec examples/06-repl.ts "greet Alice --shout"
```

**Supported export patterns:**
```typescript
// Pattern 1: Individual named exports
export const cmd1 = defineCommand({ ... })

// Pattern 2: Default export
export default { cmd1, cmd2 }

// Pattern 3: Named 'commands' export
export const commands = { cmd1, cmd2 }
```

---

## Local Testing with runCli()

For development/debugging, you can test commands locally without MCP:

```typescript
import { runCli } from "@lifeprompt/acli";

runCli({ commands: { add, multiply } });
```

```bash
npx ts-node examples/01-getting-started.ts add 10 20
npx ts-node examples/01-getting-started.ts help
```

This is useful for testing command logic before deploying as MCP server.

---

## Built-in Discovery Commands

Every ACLI tool automatically includes:

| Command | Description | AI Agent Use |
|---------|-------------|--------------|
| `help` | List all commands | Discover what's available |
| `help <cmd>` | Show command details | Learn arguments |
| `schema` | JSON schema for all commands | Structured discovery |
| `version` | ACLI version | Debug |

AI agents typically call `help` first to understand available commands.

---

## Next Steps

- [ACLI Documentation](../README.md)
- [Architecture Guide](../docs/ARCHITECTURE.md)
- [Specification](../docs/SPEC.md)
