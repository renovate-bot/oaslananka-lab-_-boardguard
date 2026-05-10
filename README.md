# BoardGuard

[![CI](https://github.com/oaslananka-lab/boardguard/actions/workflows/ci.yml/badge.svg)](https://github.com/oaslananka-lab/boardguard/actions/workflows/ci.yml)
[![Release](https://github.com/oaslananka-lab/boardguard/actions/workflows/release.yml/badge.svg)](https://github.com/oaslananka-lab/boardguard/actions/workflows/release.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/oaslananka-lab/boardguard/badge)](https://securityscorecards.dev/viewer/?uri=github.com/oaslananka-lab/boardguard)
[![License](https://img.shields.io/github/license/oaslananka-lab/boardguard)](LICENSE)

BoardGuard is a local-first CLI and GitHub Action for KiCad hardware design review, CI validation, DRC/ERC preflight, BOM risk checks, manufacturing release preflight, and pull request reporting.

It is the repository CI layer for hardware projects. KiCad Studio remains the local IDE and VS Code layer. KiCad MCP Pro remains the MCP execution layer. BoardGuard works by itself and does not require either integration.

The canonical repository is `oaslananka-lab/boardguard`. Package metadata, support links, release automation, and validation point to the organization repository because public CI/CD, release, support, and security gates run there.

## Install

```bash
corepack prepare pnpm@11.0.9 --activate
pnpm install --frozen-lockfile
pnpm run build
```

The package exposes the `boardguard` command from `dist/cli/main.js` after build. The GitHub Action uses the committed `dist/index.cjs` CommonJS bundle because JavaScript actions execute packaged repository code directly.

## CLI Quickstart

```bash
boardguard scan
boardguard scan --path .
boardguard scan --project hardware/main-board/main-board.kicad_pro
boardguard scan --format json
boardguard scan --sarif boardguard.sarif --json boardguard.json --markdown boardguard.md
boardguard scan --mode enforce --require-kicad true
boardguard detect
boardguard rules
boardguard version
```

Default behavior is offline, local-only, and warn mode. Warn mode exits `0` even with findings. Enforce mode exits non-zero for high or critical findings.

## GitHub Action

```yaml
name: BoardGuard

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write
  actions: read

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  boardguard:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - uses: oaslananka-lab/boardguard@<FULL_SHA_OR_VERSION_AFTER_RELEASE>
        with:
          project: hardware/main-board/main-board.kicad_pro
          mode: warn
          require-kicad: "false"
          sarif: "true"
          upload-sarif: "true"
          upload-artifacts: "true"
```

Strict gate:

```yaml
with:
  mode: enforce
  require-kicad: "true"
```

## Configuration

```yaml
version: 1

project:
  path: hardware/main-board/main-board.kicad_pro
  require_kicad_cli: false

reports:
  json: true
  sarif: true
  markdown: true

manufacturing:
  board_name: main-board
  revision: rev-a
  output_dir: manufacturing
  expected_artifacts:
    gerber: true
    drill: true
    bom: true
    cpl: true
    schematic_pdf: true
    pcb_pdf: true
    step: false

bom:
  input: bom.csv
  required_fields:
    - Reference
    - Value
    - Footprint
    - Manufacturer
    - MPN

firmware:
  pinmap: firmware-pins.yml

kicad:
  enabled: true
  min_version: "10.0.0"
  drc:
    severity: all
    schematic_parity: true
    refill_zones: true
    severity_exclusions: true
  erc:
    severity: all
    severity_exclusions: true

rules:
  BG-PROJ-001: error
  BG-KICAD-001: warning
  BG-BOM-001: warning
  BG-MFG-001: warning
  BG-PIN-001: error
```

The configuration schema is published in `boardguard.schema.json`. Output precedence is CLI flags, then GitHub Action inputs, then `boardguard.yml`, then defaults. A rule value of `off` suppresses that rule; `error` maps to high severity and `warning` maps to medium severity.

## Rules

The first rule set includes project discovery, malformed design files, KiCad CLI availability, ERC/DRC failure handling, BOM metadata gaps, duplicate designators, manufacturing metadata, manufacturing output planning, and experimental pinmap consistency.

See [docs/rules.md](docs/rules.md) for rule IDs, severities, remediation, and maturity.

## Output Formats

BoardGuard writes deterministic JSON, SARIF 2.1.0, and Markdown summaries. SARIF upload is opt-in. GitHub job summaries are written when the Action runs inside GitHub Actions.

## KiCad CLI Behavior

BoardGuard detects `kicad-cli`, supports an explicit CLI path, runs `version`, and invokes ERC/DRC with argument arrays and timeouts. If KiCad CLI is unavailable, checks are skipped unless `require-kicad` is true.

When configured, BoardGuard probes `kicad-cli ... --help` before adding newer KiCad DRC/ERC flags such as `--severity-all`, `--severity-exclusions`, `--schematic-parity`, and `--refill-zones`. This lets KiCad 9 installations run with their supported flags while allowing stricter KiCad 10 checks when available.

## Security and Privacy

BoardGuard treats repository content as untrusted input. It does not execute project scripts, call external APIs, upload repository data by default, or require cloud credentials. Optional SARIF and artifact uploads go only to the current GitHub Actions run when explicitly enabled.

## Current Limitations

KiCad static parsing is intentionally conservative. BOM extraction supports common schematic properties and CSV columns. Pinmap semantic matching is experimental and only checks extracted schematic labels.

## Development

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm test
pnpm run action:build
pnpm run pack:check
pnpm run cli:smoke
pnpm run action:smoke
pnpm run scan:fixtures
pnpm run release:dry-run
```

Release automation uses release-please manifest mode. Package version, changelog entries, and release tags are derived from Conventional Commit history and release-please state. Release assets are built on GitHub Actions, with package validation, smoke tests, checksums, SBOM generation, and artifact attestations. No package registry, container registry, marketplace, or KiCad PCM publishing is enabled in the current release model.
