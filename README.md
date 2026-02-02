# acli - Agent CLI

[![CI](https://github.com/lifeprompt-team/acli/actions/workflows/ci.yml/badge.svg)](https://github.com/lifeprompt-team/acli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@lifeprompt/acli.svg)](https://www.npmjs.com/package/@lifeprompt/acli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**acli** (Agent CLI) is a lightweight CLI protocol for AI agents built on top of MCP (Model Context Protocol).

## Why acli?

Traditional MCP tool definitions require extensive schema for each tool, consuming valuable context window space. acli solves this by:

- **Single Tool Definition**: One MCP tool (`cli`) handles all commands
- **Dynamic Discovery**: Agents learn commands via `help` and `schema`
- **Shell-less Security**: No shell execution, preventing injection attacks
- **Structured Output**: JSON responses with standardized error codes

## Installation

```bash
npm install @lifeprompt/acli
# or
pnpm add @lifeprompt/acli
```

## Quick Start

```typescript
import { createAcli, defineCommands } from '@lifeprompt/acli'

const commands = defineCommands({
  calendar: {
    description: "Manage calendar",
    subcommands: {
      events: {
        description: "List calendar events",
        args: {
          today: { type: "flag", description: "Today's events" },
          max: { type: "integer", default: 10 },
        },
        handler: async ({ today, max }) => {
          const events = await getCalendarEvents({ today, maxResults: max })
          return { events }
        }
      }
    }
  }
})

// Create MCP tool
const cliTool = createAcli(commands)

// Register with your MCP server
mcpServer.registerTool(cliTool)
```

## Usage

Once registered, AI agents can use the tool like this:

```
cli("help")                           # List available commands
cli("help calendar events")           # Get command details
cli("calendar events --today")        # Execute command
cli("schema calendar events")         # Get JSON schema
```

## Response Format

### Success

```json
{
  "success": true,
  "data": {
    "events": [
      { "id": "evt_123", "summary": "Meeting", "start": "2026-02-02T10:00:00Z" }
    ]
  },
  "message": "Found 1 event"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format for --from",
    "hint": "Use ISO8601 format (e.g., 2026-02-02)",
    "examples": ["calendar events --from 2026-02-02"]
  }
}
```

## Security

acli is designed with security in mind:

- **No Shell Execution**: Commands are parsed and executed directly, never through a shell
- **Forbidden Characters**: `` ; & | ` $ ( ) { } [ ] < > ! \ `` are blocked
- **Command Whitelist**: Only registered commands can be executed
- **Path Traversal Prevention**: `..` and absolute paths are sanitized

## Documentation

- [Full Specification](./docs/SPEC.md)

## License

MIT
