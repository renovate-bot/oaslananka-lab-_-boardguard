# BoardGuard

BoardGuard is a local-first CLI and GitHub Action for KiCad hardware design review, CI validation, DRC/ERC preflight, BOM risk checks, manufacturing release preflight, and pull request reporting.

It is the repository CI layer for hardware projects. KiCad Studio remains the local IDE and VS Code layer. KiCad MCP Pro remains the MCP execution layer. BoardGuard works by itself in v0.1 and does not require either integration.

The personal repository `oaslananka/boardguard` is the source/original content repository. The organization repository `oaslananka-lab/boardguard` carries byte-equivalent project contents and is the guarded CI/CD, release, support, and security boundary. Package and Action metadata point to the organization repository because public support, release automation, and validation run there.

## Install

```bash
corepack prepare pnpm@11.0.8 --activate
pnpm install --frozen-lockfile
pnpm run build
```

The package exposes the `boardguard` command after build. The GitHub Action uses the committed `dist/index.js` bundle because JavaScript actions execute packaged repository code directly.

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
```

## Rules

The first rule set includes project discovery, malformed design files, KiCad CLI availability, ERC/DRC failure handling, BOM metadata gaps, duplicate designators, manufacturing metadata, manufacturing output planning, and experimental pinmap consistency.

See [docs/rules.md](docs/rules.md) for rule IDs, severities, remediation, and maturity.

## Output Formats

BoardGuard writes deterministic JSON, SARIF 2.1.0, and Markdown summaries. SARIF upload is opt-in. GitHub job summaries are written when the Action runs inside GitHub Actions.

## KiCad CLI Behavior

BoardGuard detects `kicad-cli`, supports an explicit CLI path, runs `version`, and invokes ERC/DRC with argument arrays and timeouts. If KiCad CLI is unavailable, checks are skipped unless `require-kicad` is true.

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
pnpm run scan:fixtures
```

Release automation is prepared with release-please manifest mode. The initial version is `0.1.0`. No package registry, container registry, marketplace, or KiCad PCM publishing is enabled in v0.1.
