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

## Beta Release Flow

新機能を正式リリース前にテストしたい場合、`beta` ブランチ経由でbetaバージョンをnpmに公開できます。

### ブランチ構成

```
main (安定版)
  └─ beta (次のリリース候補をまとめる)
       ├─ feature/aclify をマージ → 0.7.0-beta.0
       ├─ feature/xxx をマージ    → 0.7.0-beta.1
       └─ テスト完了 → mainにマージ → 0.7.0 (正式版)
```

### 新機能をbetaに追加する

```bash
# 1. mainからfeatureブランチを作って開発
git checkout -b feature/xxx main
# ... 実装・テスト ...
git commit -m "feat: add xxx"

# 2. betaブランチにマージ
git checkout beta
git merge feature/xxx

# 3. betaバージョンを上げてnpmに公開
npm version 0.7.0-beta.N --no-git-tag-version  # Nをインクリメント
pnpm build
npm publish --tag beta

# 4. コミット & push
git add -A && git commit -m "0.7.0-beta.N"
git push
```

### betaを試す（利用者側）

```bash
pnpm add @lifeprompt/acli@beta        # 最新のbeta
pnpm add @lifeprompt/acli@0.7.0-beta.0  # 特定のbeta
```

通常の `pnpm add @lifeprompt/acli` は安定版のままなので、既存ユーザーに影響はありません。

### betaを正式リリースする

```bash
# betaでのテストが完了したら
git checkout main
git merge beta
npm version minor   # 0.7.0
git push && git push --tags  # CI が自動で npm publish + GitHub Release
```

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
