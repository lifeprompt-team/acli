# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.7.3] - 2026-02-10

### Added

- **Interactive REPL (`acli repl`):** Load commands from a JS/TS file and explore them interactively with tab completion, command history, and colored output. Supports `.exit`, `.clear`, and all built-in discovery commands (`help`, `schema`, `version`).
- **Single command execution (`acli exec`):** Execute a single ACLI command from a file and exit. Useful for scripting and CI pipelines.
- **CLI entry point (`src/bin.ts`):** New standalone binary entry point for `npx @lifeprompt/acli`. Provides `repl`, `exec`, `--help`, and `--version` subcommands.
- **Module loader with TypeScript support:** Dynamically imports JS/TS files exporting ACLI commands. Supports three export patterns: default export, named `commands` export, and individual named exports. Falls back to [jiti](https://github.com/unjs/jiti) for TypeScript on older Node.js runtimes.
- **Example:** `examples/06-repl.ts` — Demonstrates REPL usage with various command types (positional args, flags, subcommands).

### Changed

- **`bin` entry updated:** `package.json` `bin` now points to `dist/bin.js` (was `dist/cli.js`). The `cli.ts` module remains unchanged as a library export (`runCli`).
- **`tsup.config.ts` split into 3 build targets:** Library (CJS + ESM + DTS), REPL module (ESM), and CLI binary (ESM + shebang).
- **New `./repl` export:** `package.json` `exports` now includes `"./repl"` for programmatic REPL/loader access.

---

## [0.7.2] - 2026-02-10

### Added

- **SECURITY.md:** Security policy with vulnerability reporting flow, security model documentation, and explicit implementation responsibility boundary.
- **Unicode & boundary value tests:** Comprehensive tests for Japanese, Chinese, Korean, emoji, RTL text, combining characters, full-width characters, surrogate pairs, and edge cases (boundary lengths, zero/negative numbers, empty strings, etc.).
- **CI: Node.js version matrix:** Tests now run on Node.js 18, 20, and 22 (matching `engines: ">=18.0.0"`).
- **CI: Zod compatibility matrix:** Tests run against multiple Zod v3 versions to verify peer dependency compatibility.
- **CI: Coverage reporting:** Test coverage with `@vitest/coverage-v8`, uploaded to Codecov on Node.js 20 runs.
- **npm provenance:** Packages are now published with `--provenance` for supply chain verification.

### Changed

- **SPEC.md promoted to v1.0.0-rc.1:** Updated from Draft/Proposal status to Release Candidate. Security section (§8) now includes explicit implementation responsibility boundary (§8.4). ABNF grammar updated to reflect combined short options, flag negation, and array accumulation.

---

## [0.7.1] - 2026-02-09

### Fixed

- **`zod` moved from `dependencies` to `peerDependencies`:** Previously, declaring `zod` as a direct dependency with `"^3.23.0 || ^4.0.0"` caused package managers (especially pnpm) to resolve a separate zod instance for ACLI, potentially a different major version than the host project. This resulted in TypeScript type mismatches when passing Zod schemas (e.g., `z.string()`) to `arg()`. Now zod is a peer dependency, ensuring the host project's single zod instance is used throughout.

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
