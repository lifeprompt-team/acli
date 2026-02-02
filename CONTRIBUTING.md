# Contributing to ACLI

Thank you for your interest in contributing to ACLI!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/lifeprompt-team/acli.git
cd acli

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Watch mode for development |
| `pnpm build` | Build the package |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm lint` | Check for lint errors |
| `pnpm lint:fix` | Auto-fix lint errors |
| `pnpm format` | Format code |
| `pnpm typecheck` | Type check |

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `pnpm lint && pnpm test:run && pnpm build`
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Style

- We use [Biome](https://biomejs.dev/) for linting and formatting
- Run `pnpm lint:fix` before committing

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
