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

**Single source of truth:** `package.json` の `"version"` フィールド

### How it works

1. `tsup.config.ts` がビルド時に `package.json` を読み込み
2. `__VERSION__` としてコードに注入
3. `src/index.ts` がエクスポート

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

- **No sync issues**: バージョンを2箇所で管理する必要がない
- **npm standard**: `npm version` コマンドが使える
- **CI/CD friendly**: 自動化が容易

---

## Release Flow

### Prerequisites

```bash
# npm にログイン済みであることを確認
npm whoami
```

### Full Release Flow

```bash
# 1. PR をマージ（GitHub UI または CLI）
gh pr merge <PR_NUMBER> --squash

# 2. main に切り替えて最新を取得
git checkout main
git pull

# 3. バージョンを更新（自動で commit + tag 作成）
npm version patch   # 0.6.0 → 0.6.1 (bug fixes)
npm version minor   # 0.6.0 → 0.7.0 (new features)
npm version major   # 0.6.0 → 1.0.0 (breaking changes)

# 4. リモートに push
git push && git push --tags

# 5. npm に公開
npm publish

# 6. GitHub Release を作成（オプション）
gh release create v0.7.0 --generate-notes
```

### What `npm version` does

- Updates `package.json` version
- Creates a git commit with message `v0.7.0`
- Creates a git tag `v0.7.0`

---

## CI/CD

- **GitHub Actions**: Tests run on every push
- **Release**: Manual or triggered by version tag

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
