# Release beta → main

Create a PR to release the beta branch to main, and perform post-merge cleanup.

## Prerequisites

1. Confirm the current branch is `beta`
2. Ensure beta is up to date (`git pull origin beta`)
3. Verify all tests, build, and lint pass

## Create PR

### PR title format

```text
release: v<version>
```

Examples: `release: v0.7.0`, `release: v0.7.0-beta.3`

### PR body template

Transcribe the relevant version's changes from CHANGELOG.md.

```markdown
## Release Summary
<Transcribe from CHANGELOG: overview of changes in this release>

## Included Changes
- feat: <feature> (#PR)
- fix: <fix> (#PR)
- ...

## Checklist
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Lint clean
```

### Merge method

Use **Squash and merge** on GitHub.

## Post-merge cleanup (CRITICAL)

After squash merge, recreate the beta branch from main.
**Skipping this step will cause conflict hell on the next PR.**

```bash
# 1. Delete the old beta branch
git push origin --delete beta

# 2. Update main
git checkout main
git pull origin main

# 3. Recreate beta from main
git checkout -b beta
git push -u origin beta
```

## npm publish (if needed)

```bash
# Stable release
npm publish

# Beta release
npm publish --tag beta
```

Always confirm with the user before publishing.
