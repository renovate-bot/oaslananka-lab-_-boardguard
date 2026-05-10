# Development

Prerequisites:

- Node.js 24 LTS for the Action runtime, with CI compatibility coverage for Node 26 Current
- pnpm 11.0.9 through Corepack
- Optional `kicad-cli` for KiCad-backed ERC/DRC checks
- Optional Task for `Taskfile.yml`

Common commands:

```bash
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm test
pnpm run action:build
pnpm run scan:fixtures
pnpm run pack:check
pnpm run cli:smoke
pnpm run action:smoke
pnpm run release:dry-run
```

Add a rule by updating `src/core/findings.ts`, adding detection in `src/rules`, documenting it in `docs/rules.md`, adding unit coverage, and adding or updating fixtures when useful.

Add a KiCad fixture under `tests/fixtures/projects/<name>` and regenerate expected reports with:

```bash
pnpm run build
pnpm run scan:fixtures -- --update
```
