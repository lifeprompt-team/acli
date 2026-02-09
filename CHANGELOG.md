# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.7.0] - 2026-02-09

### Breaking Changes

#### `registerAcli` signature simplified

```typescript
// Before
registerAcli(server, commands, { name: "math", description: "..." })

// After
registerAcli(server, "math", commands, "Mathematical operations.")
```

**Migration:** Swap the 2nd and 3rd arguments. If you were passing `{ name, description }`, extract `name` as the 2nd argument and pass `description` as a plain string in the 4th argument.

#### `AcliToolOptions` deprecated

The `AcliToolOptions` interface is removed. Pass `description` as a plain string in the 4th argument of `registerAcli`.

#### Arg option `alias` renamed to `short`

Short option aliases are now declared explicitly via the `short` property. Auto-detection from the first letter has been removed.

```typescript
// Before
arg(z.boolean().default(false), { alias: "v" })

// After
arg(z.boolean().default(false), { short: "v" })
```

### Added

- **`aclify` helper function:** Convert MCP-style tool definitions (`McpToolLike`) to ACLI `CommandRegistry` for gradual migration from traditional MCP tools.
- **Flag negation (`--no-` prefix):** Boolean flags can be set to `false` using `--no-verbose`, `--no-color`, etc.
- **Combined short options:** `-abc` is equivalent to `-a -b -c`. A value-taking option can appear at the end (e.g., `-vH value`, `-vHvalue`, `-vH=value`).
- **End-of-options marker (`--`):** Arguments after `--` are treated as positional values, even if they start with dashes.
- **Repeated options (array accumulation):** `z.array()` arguments accumulate values from repeated options: `--tag a --tag b` → `["a", "b"]`.
- **Automatic type coercion:** `z.number()`, `z.date()`, and `z.bigint()` are automatically coerced from string inputs at the parser level. Works through `.refine()` and `.transform()` without needing `z.coerce.*`.
- **Enhanced help output:**
  - `short` field for short aliases (e.g., `short: "v"`).
  - `negatable` field for boolean arguments.
  - Auto-generated `usage` string (e.g., `search <query> [<path>] [--verbose]`).
  - Positional arguments displayed as `<name>` format.
  - Array types displayed as `string[]` instead of `array`.

### Changed

- **Zod v4 forward-compatible:** Removed all `_def` internal API access. The parser uses only `instanceof` checks and public API methods, ensuring compatibility with both Zod v3 and the upcoming Zod v4.
- **AGENTS.md and CHANGELOG.md included in npm package** for better discoverability.
- **AGENTS.md updated:** Added Compatibility section (Zod, MCP SDK, Agent SDKs).

### Fixed

- Schema unwrapping logic (`ZodOptional`, `ZodDefault`) now handles arbitrary nesting order correctly.
- `--no-` prefix prioritizes literal argument names over negation (e.g., `--no-reply-email` maps to `no_reply_email` if defined, instead of negating `reply_email`).
- Short options longer than 2 characters (e.g., `-abc`, `-Hvalue`) were silently treated as positional arguments. Now correctly parsed or rejected.

---

## [0.6.x and earlier]

See [git history](https://github.com/lifeprompt-team/acli/commits/main) for previous changes.
