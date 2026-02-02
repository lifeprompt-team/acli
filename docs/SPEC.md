# acli - Agent CLI Specification

**Version:** 0.1.0 (Draft)  
**Date:** 2026-02-02  
**Status:** Proposal

---

## 1. Overview

### 1.1 What is acli?

**acli** (Agent CLI) は、AIエージェントがツールを操作するための軽量なCLIベースのプロトコルです。MCP (Model Context Protocol) の上に構築され、単一のMCPツール定義でCLI形式のコマンドインターフェースを提供します。

**読み方:** エークリ / エーシーエルアイ  
**npm:** `@sunaba/acli`

### 1.2 Design Goals

| 目標 | 説明 |
|------|------|
| **コンテキスト効率** | MCPツール定義を最小化し、知識は `help` で動的取得 |
| **シェルレス** | セキュリティのためにシェルを完全に排除 |
| **ゼロトラスト** | エージェントの入力を信頼しない前提で設計 |
| **教育的エラー** | 失敗から学べるエラーメッセージ |
| **発見可能性** | 安全に探索できるヘルプ体系 |
| **人間互換** | 人間もエージェントも同じインターフェース |

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
│  │                 acli Tool ("cli")                     │  │
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
| **acli (this)** | In-MCP CLI Gateway | **Unique position** |

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
│    - Check forbidden characters         │
│    - Verify command whitelist           │
│    - Sanitize arguments                 │
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

すべてのacli実装は、以下のMCPツール定義を公開しなければなりません (MUST)。

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

従来のMCPアプローチでは、各ツールを個別に定義します：

```json
// 従来: 100個のツール = 100個のスキーマ定義 = 大量のコンテキスト消費
{ "name": "calendar_events", "inputSchema": { ... } }
{ "name": "calendar_create", "inputSchema": { ... } }
{ "name": "drive_list", "inputSchema": { ... } }
// ... 97 more tools
```

acliでは1つのツール定義で全機能をカバー：

```json
// acli: 1つのツール定義 = 最小限のコンテキスト
{ "name": "cli", "inputSchema": { "command": "string" } }
```

エージェントは `help` コマンドで必要な情報を動的に取得します。

---

## 4. Parser Specification (Layer 2)

### 4.1 Tokenization

#### 4.1.1 Basic Rules

コマンド文字列は POSIX 準拠のシェル引数分割規則に従ってトークン化されます。

```
Input:  "calendar events --from '2026-02-01' --max 10"
Output: ["calendar", "events", "--from", "2026-02-01", "--max", "10"]
```

#### 4.1.2 Quoting

| Quote Type | Behavior |
|------------|----------|
| Single quotes (`'...'`) | リテラル文字列、エスケープなし |
| Double quotes (`"..."`) | 文字列、バックスラッシュエスケープ有効 |
| Backslash (`\`) | 次の1文字をエスケープ |

```
'hello world'     → hello world
"hello \"world\"" → hello "world"
hello\ world      → hello world
```

### 4.2 Security Validation

#### 4.2.1 Forbidden Characters

以下の文字を含むコマンドは拒否されなければなりません (MUST)。

```
; & | ` $ ( ) { } [ ] < > ! \
```

**例:**
```
Input:  "calendar events; rm -rf /"
Result: ERROR - INJECTION_BLOCKED
```

#### 4.2.2 Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max command length | 10,000 characters | DoS防止 |
| Max argument count | 100 | 配列枯渇防止 |
| Max argument length | 10,000 characters | メモリ保護 |

#### 4.2.3 Path Traversal Prevention

パス引数に `..` または絶対パス (`/`, `C:\`) を含む場合、サニタイズまたは拒否すべきです (SHOULD)。

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

**例:**
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

**例:**
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
| `PARSE_ERROR` | コマンド文字列のパースに失敗 | 400 |
| `INJECTION_BLOCKED` | インジェクション攻撃を検出 | 400 |
| `COMMAND_NOT_FOUND` | コマンドが存在しない | 404 |
| `PERMISSION_DENIED` | 権限が不足 | 403 |
| `VALIDATION_ERROR` | 引数のバリデーションに失敗 | 400 |
| `EXECUTION_ERROR` | コマンド実行中のエラー | 500 |
| `TIMEOUT` | 実行がタイムアウト | 504 |
| `RATE_LIMITED` | レート制限に到達 | 429 |
| `PATH_TRAVERSAL_BLOCKED` | パストラバーサル攻撃を検出 | 400 |

### 5.3 MCP Content Mapping

acliレスポンスは、MCP の `CallToolResult` にマッピングされます：

```typescript
// acli Response → MCP CallToolResult
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

以下のコマンドはすべてのacli実装で予約されており、実装されなければなりません (MUST)。

| Command | Description |
|---------|-------------|
| `help` | コマンド一覧を表示 |
| `help <command>` | 特定コマンドの詳細を表示 |
| `schema` | 全コマンドのスキーマをJSON形式で出力 |
| `schema <command>` | 特定コマンドのスキーマを出力 |
| `version` | acliバージョンと実装情報を出力 |

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
    "description": "acli-compatible CLI for Google Workspace operations",
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
      "name": "sunaba-acp",
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

コマンドは階層的に構成されます：

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
| `string` | 任意の文字列 | `"hello world"`, `file.txt` |
| `integer` | 整数 | `10`, `-5`, `0` |
| `number` | 数値（小数含む） | `3.14`, `-0.5` |
| `boolean` | `true` / `false` | `true`, `false` |
| `flag` | 存在で true | `--today` (引数なし) |
| `datetime` | ISO8601 | `2026-02-02`, `2026-02-02T10:00:00Z` |
| `array` | カンマ区切り | `a,b,c` → `["a", "b", "c"]` |

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
| Shell Injection | シェルを使用しない (execve不使用) |
| Command Injection | コマンドホワイトリスト |
| Argument Injection | 禁止文字の検出・拒否 |
| Path Traversal | パス正規化・検証 |
| DoS | 長さ・数量制限 |
| Privilege Escalation | コマンドレベルの権限分離 |

### 8.2 Command Allowlist

実装は、実行可能なコマンドのホワイトリストを維持すべきです (SHOULD)。

```typescript
const ALLOWED_COMMANDS = new Set([
  "calendar", "drive", "gmail", "sheets",
  "help", "schema", "version"
])

const DENIED_SUBCOMMANDS = new Map([
  ["gmail", new Set(["delegates", "autoforward"])],  // 危険な操作
])
```

### 8.3 Audit Logging

実装は、すべてのコマンド実行を監査ログに記録すべきです (SHOULD)。

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

実装は、標準コマンドに加えて独自コマンドを追加できます (MAY)。

カスタムコマンドは `x-` プレフィックスを使用すべきです (SHOULD)：

```
x-mycompany-special-tool --option value
```

### 9.2 Capability Declaration

`version` コマンドで、サポートする拡張機能を宣言できます：

```json
{
  "acp_version": "0.1.0",
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

最小限のacli実装に必要な要素：

1. **MCP Tool 登録** - `cli` ツールを公開
2. **Parser** - 安全なトークナイザー
3. **Router** - コマンドルーティング
4. **Discovery** - `help`, `schema`, `version`
5. **Response Formatter** - AcliResponse構造

### 10.2 Reference Implementation Structure

```
@sunaba/acli
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
import { createAcli, defineCommands } from '@sunaba/acli'

// Define commands
const commands = defineCommands({
  calendar: {
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

準拠テストは以下のカテゴリを検証します：

1. **Parser Tests** - トークン化、禁止文字検出
2. **Security Tests** - インジェクション防止
3. **Discovery Tests** - help/schema/version の正確性
4. **Response Tests** - レスポンス形式の準拠

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
| `INJECTION_BLOCKED` | "Forbidden character detected: {char}" | "Remove shell metacharacters" |
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
