# Architecture

BoardGuard is a TypeScript CLI and JavaScript GitHub Action sharing the same analysis engine.

Core flow:

1. Discover KiCad projects under a scan path or explicit `.kicad_pro`.
2. Parse KiCad project, schematic, and PCB text as untrusted input.
3. Optionally invoke `kicad-cli` through argument arrays with timeouts.
4. Run deterministic rules.
5. Emit JSON, SARIF 2.1.0, Markdown, and GitHub job summaries.

Boundaries:

- `src/core` coordinates analysis and config.
- `src/kicad` parses KiCad text and invokes KiCad CLI.
- `src/rules` contains rule detection only.
- `src/report` formats machine and human reports.
- `src/action` writes outputs, summaries, optional artifacts, and optional SARIF upload.

Future path:

- A future GitHub App can consume BoardGuard JSON reports.
- KiCad Studio can run `boardguard scan` locally and render JSON findings in VS Code.
- KiCad MCP Pro can call BoardGuard as a quality gate or consume reports.
