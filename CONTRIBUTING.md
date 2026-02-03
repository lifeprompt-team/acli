# Contributing to ACLI

## Development Setup

```bash
git clone https://github.com/lifeprompt-team/acli.git
cd acli
pnpm install
```

### Commands

```bash
pnpm test        # Run tests (watch mode)
pnpm test:run    # Run tests once
pnpm build       # Build package
pnpm typecheck   # Type check
pnpm lint        # Lint code
pnpm lint:fix    # Fix lint errors
```

---

## Project Structure

```
src/
├── index.ts          # Main exports + VERSION
├── cli.ts            # Standalone CLI runner (runCli)
├── executor/         # Command execution logic
├── parser/           # Argument parsing (Zod-based)
├── router/           # Command registry & routing
├── discovery/        # Built-in commands: help, schema, version
├── response/         # Error types
└── mcp/              # MCP tool integration (registerAcli, createAcli)
```

---

## Version Management

**Single source of truth:** The `"version"` field in `package.json`

### How it works

1. `tsup.config.ts` reads `package.json` at build time
2. Injects version as `__VERSION__` into the code
3. `src/index.ts` exports it

```typescript
// tsup.config.ts
define: {
  __VERSION__: JSON.stringify(pkg.version),
}

// src/index.ts
declare const __VERSION__: string | undefined
export const VERSION =
  typeof __VERSION__ !== 'undefined'
    ? __VERSION__                              // Production (built)
    : require('../package.json').version       // Development/Test
```

### Why this approach?

- **No sync issues**: No need to maintain version in multiple places
- **npm standard**: Works with `npm version` command
- **CI/CD friendly**: Easy to automate

---

## Release Flow

Pushing a tag triggers CI to automatically publish to npm and create a GitHub Release.

```bash
# 1. Merge PR
gh pr merge <PR_NUMBER> --squash

# 2. Switch to main and pull latest
git checkout main
git pull

# 3. Update version (automatically creates commit + tag)
npm version patch   # 0.6.0 → 0.6.1 (bug fixes)
npm version minor   # 0.6.0 → 0.7.0 (new features)
npm version major   # 0.6.0 → 1.0.0 (breaking changes)

# 4. Push (CI automatically publishes to npm + creates GitHub Release)
git push && git push --tags
```

### What happens automatically

1. `npm version` → Updates package.json + creates commit + tag
2. `git push --tags` → Triggers CI
3. CI (`.github/workflows/release.yml`):
   - Publishes to npm
   - Creates GitHub Release

**Note:** You don't need to manually run `npm publish` or `gh release create`.

---

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Every push/PR | Test, Lint, Type check |
| `release.yml` | Tag push (`v*`) | npm publish + GitHub Release |

---

## Code Style

- **Formatter**: Biome
- **Linter**: Biome
- **TypeScript**: Strict mode

Run before committing:

```bash
pnpm lint:fix
pnpm typecheck
pnpm test:run
```

---

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Make changes with tests
3. Run `pnpm lint:fix && pnpm typecheck && pnpm test:run`
4. Create PR with clear description
5. Squash merge to `main`
