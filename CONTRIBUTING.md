# Contributing

Use Node.js 24 LTS and pnpm 11.

```bash
corepack prepare pnpm@11.0.8 --activate
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm test
pnpm run action:build
pnpm run scan:fixtures
```

Use Conventional Commits. Do not commit generated reports, credentials, local notes, dependency folders, or build output other than the intentional JavaScript action bundle at `dist/index.js`.
