# Create feature → beta PR

Create a PR to merge the current feature branch into beta.

## Prerequisites

1. Confirm the current branch is `feature/*`
2. Ensure all changes are committed
3. Verify all tests, build, and lint pass

## Create PR

### PR title format

Prefix + concise description of the change.

| Prefix | Usage |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Refactoring (no behavior change) |
| `docs:` | Documentation only |
| `chore:` | Build, CI, dependency changes |

Examples:
- `feat: combined short options and Zod v4 compatibility`
- `fix: silent positional fallback for unknown short options`
- `docs: add compatibility section to AGENTS.md`

### PR body template

```markdown
## Summary
- <bullet points describing the changes (3-5 items)>

## Test plan
- [ ] `nr test:run` all pass
- [ ] `nr build` succeeds
- [ ] `nr lint` clean
```

### Base branch

Always target **beta** (not main).

```bash
git push -u origin HEAD
gh pr create --base beta --title "feat: ..." --body "..."
```

### Merge method

Either regular merge or squash merge is fine for feature → beta.
