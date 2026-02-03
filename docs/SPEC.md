# ACLI - Agent CLI Specification

**Version:** 0.1.0 (Draft)
**Date:** 2026-02-02
**Status:** Proposal

---

## 1. Overview

### 1.1 What is ACLI?

**ACLI** (Agent CLI) is a lightweight CLI-based protocol for AI agents to operate tools. Built on top of MCP (Model Context Protocol), it provides a CLI-style command interface through a single MCP tool definition.

**Pronunciation:** A-C-L-I / Agent CLI
**npm:** `@lifeprompt/acli`

### 1.2 Design Goals

| Goal | Description |
|------|-------------|
| **Context Efficiency** | Minimize MCP tool definitions; knowledge is retrieved dynamically via `help` |
| **Shell-less** | Completely eliminate shell for security |
| **Zero Trust** | Design assumes agent input cannot be trusted |
| **Educational Errors** | Error messages that enable learning from failures |
| **Discoverability** | Help system that allows safe exploration |
| **Human Compatible** | Same interface for both humans and agents |

### 1.3 Position in the Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Claude, GPT, etc.)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP (Model Context Protocol)             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 ACLI Tool ("cli")                     │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              CLI Gateway (Parser/Guard)         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                         │                             │  │
│  │  ┌──────────┬──────────┼──────────┬──────────────┐   │  │
│  │  ▼          ▼          ▼          ▼              ▼   │  │
│  │ calendar   drive     gmail     sheets    ... commands│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Comparison with Existing Solutions

| Protocol | Scope | Relationship |
|----------|-------|--------------|
| **MCP** | LLM ↔ Tools (fine-grained) | Base layer |
| **mcpc** | MCP CLI client (external) | Similar concept, different approach |
| **A2A** | Agent-to-Agent | Upper layer (no overlap) |
| **Agent Client Protocol** | IDE ↔ Agent | Different domain |
| **ACLI (this)** | In-MCP CLI Gateway | **Unique position** |

---

## 2. Architecture

### 2.1 Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Discovery                                          │
│   help, schema, version                                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Response Format                                    │
│   AcliResponse (success/error structure)                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Parser & Security                                  │
│   Tokenization, validation, injection prevention            │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: MCP Integration                                    │
│   Single "cli" tool definition                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Input: "calendar events --today --max 10"
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. Tokenize                             │
│    → ["calendar", "events", "--today",  │
│       "--max", "10"]                    │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. Validate                             │
│    - Verify command whitelist           │
│    - Check argument types               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. Route                                │
│    → calendar.events handler            │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. Execute (Shell-less)                 │
│    Direct function call                 │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 5. Format Response                      │
│    → AcliResponse (JSON)                 │
└─────────────────────────────────────────┘
```

---

## 3. MCP Tool Definition (Layer 1)

### 3.1 Tool Schema

All ACLI implementations MUST expose the following MCP tool definition.

```json
{
  "name": "cli",
  "description": "Execute CLI command. Run 'help' for available commands.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "description": "CLI command string (e.g., 'calendar events --today')"
      }
    },
    "required": ["command"]
  }
}
```

### 3.2 Rationale

Traditional MCP approach defines each tool individually:

```json
// Traditional: 100 tools = 100 schema definitions = massive context consumption
{ "name": "calendar_events", "inputSchema": { ... } }
{ "name": "calendar_create", "inputSchema": { ... } }
{ "name": "drive_list", "inputSchema": { ... } }
// ... 97 more tools
```

ACLI covers all functionality with a single tool definition:

```json
// ACLI: 1 tool definition = minimal context
{ "name": "cli", "inputSchema": { "command": "string" } }
```

Agents retrieve necessary information dynamically via the `help` command.

---

## 4. Parser Specification (Layer 2)

### 4.1 Tokenization

#### 4.1.1 Basic Rules

Command strings are tokenized following POSIX-compliant shell argument splitting rules.

```
Input:  "calendar events --from '2026-02-01' --max 10"
Output: ["calendar", "events", "--from", "2026-02-01", "--max", "10"]
```

#### 4.1.2 Quoting

| Quote Type | Behavior |
|------------|----------|
| Single quotes (`'...'`) | Literal string, no escaping |
| Double quotes (`"..."`) | String with backslash escaping enabled |
| Backslash (`\`) | Escapes the next character |

```
'hello world'     → hello world
"hello \"world\"" → hello "world"
hello\ world      → hello world
```

### 4.2 Security Validation

#### 4.2.1 Shell-less Design

ACLI does NOT execute any shell commands. All input characters are treated as literal text and passed to handlers as string arguments. This eliminates shell injection vulnerabilities by design.

**Example:**
```
Input:  "calendar events; rm -rf /"
Result: ["calendar", "events;", "rm", "-rf", "/"]
        (treated as plain text tokens, not shell commands)
```

#### 4.2.2 Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max command length | 10,000 characters | DoS prevention |
| Max argument count | 100 | Array exhaustion prevention |
| Max argument length | 10,000 characters | Memory protection |

#### 4.2.3 Path Traversal Prevention

Path arguments containing `..` or absolute paths (`/`, `C:\`) SHOULD be sanitized or rejected.

```
Input:  "drive download --path ../../../etc/passwd"
Result: ERROR - PATH_TRAVERSAL_BLOCKED
```

### 4.3 Parser Interface

```typescript
interface AcliParser {
  parse(input: string): ParseResult<string[]>
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AcliError }
```

---

## 5. Response Format (Layer 3)

### 5.1 Response Structure

#### 5.1.1 Success Response

```typescript
interface AcliSuccessResponse {
  success: true
  data: unknown           // Command-specific payload (JSON-serializable)
  message?: string        // Optional human-readable summary
  _meta?: {
    command: string       // Executed command
    duration_ms: number   // Execution time
  }
}
```

**Example:**
```json
{
  "success": true,
  "data": {
    "events": [
      { "id": "evt_123", "summary": "Team Meeting", "start": "2026-02-02T10:00:00Z" },
      { "id": "evt_456", "summary": "Lunch", "start": "2026-02-02T12:00:00Z" }
    ]
  },
  "message": "Found 2 events for today",
  "_meta": {
    "command": "calendar events --today",
    "duration_ms": 142
  }
}
```

#### 5.1.2 Error Response

```typescript
interface AcliErrorResponse {
  success: false
  error: {
    code: AcliErrorCode    // Machine-readable error code
    message: string        // Human-readable error description
    hint?: string          // Suggestion for correction
    examples?: string[]    // Valid command examples
  }
  _meta?: {
    command: string
  }
}
```

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE_FORMAT",
    "message": "The --from argument has an invalid date format",
    "hint": "Use ISO8601 format (e.g., 2026-02-02 or 2026-02-02T10:00:00Z)",
    "examples": [
      "calendar events --from 2026-02-02",
      "calendar events --from 2026-02-02T10:00:00Z"
    ]
  },
  "_meta": {
    "command": "calendar events --from yesterday"
  }
}
```

### 5.2 Standard Error Codes

| Code | Description | HTTP Equivalent |
|------|-------------|-----------------|
| `PARSE_ERROR` | Failed to parse command string | 400 |
| `COMMAND_NOT_FOUND` | Command does not exist | 404 |
| `PERMISSION_DENIED` | Insufficient permissions | 403 |
| `VALIDATION_ERROR` | Argument validation failed | 400 |
| `EXECUTION_ERROR` | Error during command execution | 500 |
| `TIMEOUT` | Execution timed out | 504 |
| `RATE_LIMITED` | Rate limit reached | 429 |
| `PATH_TRAVERSAL_BLOCKED` | Path traversal attack detected | 400 |

### 5.3 MCP Content Mapping

ACLI responses are mapped to MCP's `CallToolResult`:

```typescript
// ACLI Response → MCP CallToolResult
{
  content: [
    {
      type: "text",
      text: JSON.stringify(acliResponse)
    }
  ],
  isError: !acliResponse.success
}
```

---

## 6. Discovery (Layer 4)

### 6.1 Reserved Commands

The following commands are reserved in all ACLI implementations and MUST be implemented.

| Command | Description |
|---------|-------------|
| `help` | Display command list |
| `help <command>` | Display details for specific command |
| `schema` | Output schemas for all commands in JSON format |
| `schema <command>` | Output schema for specific command |
| `version` | Output ACLI version and implementation info |

### 6.2 Help Response Format

#### 6.2.1 Root Help

```
Input:  "help"
Output:
```

```json
{
  "success": true,
  "data": {
    "description": "ACLI-compatible CLI for Google Workspace operations",
    "commands": [
      { "name": "calendar", "description": "Manage calendar events" },
      { "name": "drive", "description": "Manage Google Drive files" },
      { "name": "gmail", "description": "Manage Gmail messages" },
      { "name": "sheets", "description": "Manage Google Sheets" }
    ],
    "usage": "<command> [subcommand] [options]",
    "examples": [
      "calendar events --today",
      "drive list --max 10",
      "gmail search 'from:alice@example.com'"
    ]
  }
}
```

#### 6.2.2 Command Help

```
Input:  "help calendar events"
Output:
```

```json
{
  "success": true,
  "data": {
    "command": "calendar events",
    "description": "List calendar events with optional filters",
    "arguments": [
      {
        "name": "--today",
        "type": "flag",
        "description": "Show today's events only"
      },
      {
        "name": "--from",
        "type": "datetime",
        "description": "Start date/time (ISO8601 format)",
        "examples": ["2026-02-02", "2026-02-02T10:00:00Z"]
      },
      {
        "name": "--to",
        "type": "datetime",
        "description": "End date/time (ISO8601 format)"
      },
      {
        "name": "--max",
        "type": "integer",
        "default": 10,
        "description": "Maximum number of events to return"
      },
      {
        "name": "--calendar",
        "type": "string",
        "default": "primary",
        "description": "Calendar ID or 'primary'"
      }
    ],
    "examples": [
      "calendar events --today",
      "calendar events --from 2026-02-01 --to 2026-02-07",
      "calendar events --today --calendar work@example.com"
    ]
  }
}
```

### 6.3 Schema Response Format

```
Input:  "schema calendar events"
Output:
```

```json
{
  "success": true,
  "data": {
    "command": "calendar events",
    "inputSchema": {
      "type": "object",
      "properties": {
        "today": { "type": "boolean", "description": "Show today's events only" },
        "from": { "type": "string", "format": "date-time", "description": "Start date/time" },
        "to": { "type": "string", "format": "date-time", "description": "End date/time" },
        "max": { "type": "integer", "default": 10, "description": "Maximum results" },
        "calendar": { "type": "string", "default": "primary", "description": "Calendar ID" }
      }
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "events": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "summary": { "type": "string" },
              "start": { "type": "string", "format": "date-time" },
              "end": { "type": "string", "format": "date-time" }
            }
          }
        }
      }
    }
  }
}
```

### 6.4 Version Response Format

```
Input:  "version"
Output:
```

```json
{
  "success": true,
  "data": {
    "acli_version": "0.1.0",
    "implementation": {
      "name": "lifeprompt-acli",
      "version": "1.0.0"
    },
    "capabilities": {
      "commands": ["calendar", "drive", "gmail", "sheets"],
      "extensions": []
    }
  }
}
```

---

## 7. Command Definition

### 7.1 Command Structure

Commands are structured hierarchically:

```
<root-command> [<subcommand>...] [<positional-args>...] [<options>...]

Examples:
  calendar events --today
  drive list /Documents --max 20
  gmail send --to alice@example.com --subject "Hello"
```

### 7.2 Argument Types

| Type | Format | Examples |
|------|--------|----------|
| `string` | Any string | `"hello world"`, `file.txt` |
| `integer` | Integer | `10`, `-5`, `0` |
| `number` | Number (including decimals) | `3.14`, `-0.5` |
| `boolean` | `true` / `false` | `true`, `false` |
| `flag` | Presence means true | `--today` (no value) |
| `datetime` | ISO8601 | `2026-02-02`, `2026-02-02T10:00:00Z` |
| `array` | Comma-separated | `a,b,c` → `["a", "b", "c"]` |

### 7.3 Option Syntax

```
Short:  -n 10
Long:   --max 10
Flag:   --today (no value)
Combined: -n10 (short with value attached)
```

### 7.4 Command Registration (Implementation)

```typescript
interface CommandDefinition {
  name: string
  description: string
  subcommands?: CommandDefinition[]
  arguments?: ArgumentDefinition[]
  handler?: (args: ParsedArgs) => Promise<unknown>
}

interface ArgumentDefinition {
  name: string                    // "--from" or "fileId"
  type: ArgumentType
  required?: boolean
  default?: unknown
  description: string
  examples?: string[]
  validate?: (value: unknown) => boolean
}

type ArgumentType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "flag"
  | "datetime"
  | "array"
```

---

## 8. Security

### 8.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Shell Injection | No shell usage - all input treated as plain text |
| Command Injection | Command whitelist |
| Path Traversal | Path normalization/validation |
| DoS | Length/count limits |
| Privilege Escalation | Command-level permission separation |

### 8.2 Command Allowlist

Implementations SHOULD maintain a whitelist of executable commands.

```typescript
const ALLOWED_COMMANDS = new Set([
  "calendar", "drive", "gmail", "sheets",
  "help", "schema", "version"
])

const DENIED_SUBCOMMANDS = new Map([
  ["gmail", new Set(["delegates", "autoforward"])],  // Dangerous operations
])
```

### 8.3 Audit Logging

Implementations SHOULD log all command executions to an audit log.

```typescript
interface AuditLogEntry {
  timestamp: string       // ISO8601
  command: string         // Raw command string
  parsed_command: string  // Parsed command name
  success: boolean
  error_code?: string
  duration_ms: number
  user_context?: unknown  // Implementation-specific
}
```

---

## 9. Extension Mechanism

### 9.1 Custom Commands

Implementations MAY add custom commands in addition to standard commands.

Custom commands SHOULD use the `x-` prefix:

```
x-mycompany-special-tool --option value
```

### 9.2 Capability Declaration

Extensions can be declared via the `version` command:

```json
{
  "acli_version": "0.1.0",
  "capabilities": {
    "commands": ["calendar", "drive", "gmail"],
    "extensions": [
      "x-mycompany-analytics",
      "x-mycompany-reporting"
    ]
  }
}
```

---

## 10. Implementation Guide

### 10.1 Minimal Implementation

Elements required for a minimal ACLI implementation:

1. **MCP Tool Registration** - Expose `cli` tool
2. **Parser** - Secure tokenizer
3. **Router** - Command routing
4. **Discovery** - `help`, `schema`, `version`
5. **Response Formatter** - AcliResponse structure

### 10.2 Reference Implementation Structure

```
@lifeprompt/acli
├── src/
│   ├── parser/
│   │   ├── tokenizer.ts      # POSIX-like tokenization
│   │   ├── validator.ts      # Security validation
│   │   └── index.ts
│   ├── router/
│   │   ├── registry.ts       # Command registry
│   │   ├── matcher.ts        # Command matching
│   │   └── index.ts
│   ├── response/
│   │   ├── types.ts          # AcliResponse types
│   │   ├── errors.ts         # Standard error codes
│   │   └── formatter.ts      # Response formatting
│   ├── discovery/
│   │   ├── help.ts           # help command
│   │   ├── schema.ts         # schema command
│   │   └── version.ts        # version command
│   ├── mcp/
│   │   └── tool.ts           # MCP tool integration
│   └── index.ts              # Public API
├── package.json
└── README.md
```

### 10.3 Usage Example

```typescript
import { createAcli, defineCommand, arg } from '@lifeprompt/acli'

// Define commands
const calendar = defineCommand({
  description: "Calendar commands",
  subcommands: {
    events: {
      description: "List calendar events",
      arguments: [
        { name: "--today", type: "flag", description: "Today's events" },
        { name: "--max", type: "integer", default: 10 }
      ],
      handler: async (args) => {
        const events = await googleCalendar.listEvents(args)
        return { events }
      }
    },
    create: {
      description: "Create a calendar event",
      arguments: [
        { name: "--summary", type: "string", required: true },
        { name: "--from", type: "datetime", required: true },
        { name: "--to", type: "datetime", required: true }
      ],
      handler: async (args) => {
        const event = await googleCalendar.createEvent(args)
        return { event }
      }
    }
  }
})

// Create MCP tool
const cliTool = createAcli(commands)

// Register with MCP server
mcpServer.registerTool(cliTool)
```

---

## 11. Conformance

### 11.1 Conformance Levels

| Level | Requirements |
|-------|--------------|
| **Minimal** | Layer 1 (MCP) + Layer 2 (Parser) + `help` command |
| **Standard** | Minimal + Layer 3 (Response) + `schema`, `version` |
| **Full** | Standard + Audit logging + Extensions |

### 11.2 Test Suite

Conformance tests verify the following categories:

1. **Parser Tests** - Tokenization, quote handling, escape sequences
2. **Security Tests** - Shell-less execution, command whitelist
3. **Discovery Tests** - Accuracy of help/schema/version
4. **Response Tests** - Response format compliance

---

## Appendix A: ABNF Grammar

```abnf
command         = root-command *( SP subcommand ) *( SP argument )
root-command    = 1*ALPHA
subcommand      = 1*( ALPHA / "-" / "_" )
argument        = positional / option
positional      = value
option          = short-opt / long-opt
short-opt       = "-" ALPHA [ value ]
long-opt        = "--" 1*( ALPHA / "-" ) [ "=" value / SP value ]
value           = quoted-string / unquoted-string
quoted-string   = DQUOTE *( escaped-char / safe-char ) DQUOTE
                / "'" *safe-char "'"
unquoted-string = 1*( ALPHA / DIGIT / "-" / "_" / "." / "/" / "@" )
escaped-char    = "\" ( DQUOTE / "\" / "n" / "t" )
safe-char       = %x20-21 / %x23-26 / %x28-5B / %x5D-7E  ; exclude \ and "
```

---

## Appendix B: Error Code Reference

| Code | Message Template | Hint Template |
|------|------------------|---------------|
| `PARSE_ERROR` | "Failed to parse command: {detail}" | "Check command syntax" |
| `COMMAND_NOT_FOUND` | "Command '{cmd}' not found" | "Run 'help' for available commands" |
| `PERMISSION_DENIED` | "Permission denied for '{cmd}'" | "Check your access level" |
| `VALIDATION_ERROR` | "Invalid argument: {arg}" | "{hint}" |
| `EXECUTION_ERROR` | "Execution failed: {detail}" | "Check input and retry" |
| `TIMEOUT` | "Command timed out after {ms}ms" | "Try a simpler query" |
| `RATE_LIMITED` | "Rate limit exceeded" | "Wait {seconds}s before retry" |

---

## Appendix C: Changelog

### Version 0.1.0 (2026-02-02)

- Initial draft specification
- Core architecture defined
- Parser specification complete
- Response format defined
- Discovery commands specified

---

## References

- [Model Context Protocol (MCP) Specification](https://modelcontextprotocol.io/specification/latest)
- [mcpc - Universal MCP CLI Client](https://github.com/apify/mcp-cli)
- [Agent2Agent (A2A) Protocol](https://a2a-protocol.org/)
- [Agent Client Protocol](https://agentclientprotocol.com/)
- [gogcli - AI Agent-Friendly CLI](https://github.com/steipete/gogcli)
- [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html)
