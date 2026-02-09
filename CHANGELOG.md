# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.7.0-beta.3] - 2026-02-09

### Changed

- **Zod v4 forward-compatible:** Removed all `_def` internal API access. The parser now uses only `instanceof` checks and public API methods (`.unwrap()`, `.removeDefault()`, `.element`, `.innerType()`, `.parse()`). This makes ACLI compatible with both Zod v3 and the upcoming Zod v4.
- **Auto-coercion moved to parser level:** Instead of rewriting Zod schemas internally (`ensureCoerce`), the parser now converts string values to the expected types before Zod validation. This approach is cleaner, works through `.refine()` and `.transform()`, and has no Zod internal API dependency.
- **AGENTS.md included in npm package:** The LLM development guide is now distributed with the package, available at `node_modules/@lifeprompt/acli/AGENTS.md`.
- **CHANGELOG.md included in npm package.**
- **AGENTS.md updated:** Added Compatibility section (Zod, MCP SDK, Agent SDKs), updated auto-coercion docs, fixed broken relative links to use GitHub URLs.

---

## [0.7.0-beta.2] - 2026-02-09

### Added

- **Combined short options:** `-abc` is now equivalent to `-a -b -c`. Boolean flags can be stacked, and a value-taking option can appear at the end (e.g., `-vH value`, `-vHvalue`, `-vH=value`).
- **Attached short option values:** `-Hvalue` and `-H=value` are now supported as shorthand for `-H value`.
- **Automatic coercion:** `z.number()`, `z.date()`, and `z.bigint()` passed to `arg()` are automatically converted to their `z.coerce.*` equivalents. No more "Expected number, received string" errors from forgetting `z.coerce`.
- **Coercion hint in error messages:** When auto-coercion cannot reach the inner schema (e.g., wrapped in `ZodEffects` via `.refine()`), the error message now suggests using `z.coerce.*()`.

### Fixed

- Short options longer than 2 characters (e.g., `-abc`, `-Hvalue`) were silently treated as positional arguments instead of being parsed or rejected. They are now correctly handled.

---

## [0.7.0-beta.1] - 2026-02-09

### Breaking Changes

#### `registerAcli` signature changed

The argument order and shape of `registerAcli` has been simplified.

**Before:**

```typescript
registerAcli(server, commands, { name: "math", description: "..." })
// or
registerAcli(server, commands, "math")
```

**After:**

```typescript
registerAcli(server, "math", commands)
// or
registerAcli(server, "math", commands, "Mathematical operations.")
```

**Migration:** Swap the 2nd and 3rd arguments. If you were passing `{ name, description }`, extract `name` as the 2nd argument and pass `description` as a plain string in the 4th argument.

```typescript
// Before
registerAcli(server, { add, multiply }, { name: "math", description: "Math ops." })

// After
registerAcli(server, "math", { add, multiply }, "Math ops.")
```

#### `AcliToolOptions` deprecated

The `AcliToolOptions` interface is deprecated. The `name` field has been moved to a dedicated parameter, and `description` is now a plain string. If you imported `AcliToolOptions`, remove the import and pass `description` as a string directly.

### Added

- **Flag negation (`--no-` prefix):** Boolean flags can now be set to `false` using `--no-verbose`, `--no-color`, etc.
- **Repeated options (array accumulation):** Arguments with `z.array()` schemas now accumulate values from repeated options: `--tag a --tag b` → `["a", "b"]`.
- **Help output improvements:**
  - `short` field: Short aliases are shown as a separate field (e.g., `short: "v"`) instead of being appended to `name`.
  - `negatable` field: Boolean arguments include `negatable: true` to indicate `--no-` prefix support.
  - `usage` field: Auto-generated usage string for each command (e.g., `search <query> [<path>] [--verbose] [--limit <number>]`).
  - Positional arguments displayed as `<name>` format.
  - Array types displayed as `string[]` instead of `array`.

### Fixed

- Schema unwrapping logic (`ZodOptional`, `ZodDefault`) now handles arbitrary nesting order correctly.
- `--no-` prefix prioritizes literal argument names over negation (e.g., `--no-reply-email` maps to `no_reply_email` if defined, instead of negating `reply_email`).

---

## [0.6.x and earlier]

See [git history](https://github.com/lifeprompt/acli/commits/main) for previous changes.
