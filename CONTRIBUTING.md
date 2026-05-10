# Contributing

Use Node.js 24 LTS for the Action runtime and pnpm 11.0.9.

## Branches

Use short, scoped branch prefixes:

```text
fix/
feat/
ci/
docs/
chore/
```

## Commits

Use Conventional Commits, for example `fix:`, `feat:`, `ci:`, `docs:`, and `chore:`.

Do not commit generated reports, credentials, local notes, dependency folders, or build output other than the intentional JavaScript Action bundle at `dist/index.cjs`.

## Local validation

```bash
corepack prepare pnpm@11.0.9 --activate
pnpm install --frozen-lockfile
task ci
```

If `task` is not installed, run the equivalent pnpm commands listed in `Taskfile.yml`.

## Pull request checklist

- Format, lint, typecheck, tests, build, package validation, and security checks pass locally.
- PR changes stay scoped to one purpose.
- User-facing behavior changes include README or docs updates.
- Release-impacting changes preserve release-please as the version source of truth.
- No secret values, local notes, or generated reports are committed.

## Release process

Release automation is documented in `docs/release.md`.
