# GitHub Action

The Action runs on Node 24 from the committed `dist/index.cjs` CommonJS bundle and writes reports under `boardguard-results/`.

Inputs include `path`, `project`, `config`, `mode`, `require-kicad`, `kicad-cli`, `bom`, `pinmap`, report toggles, `upload-sarif`, and `upload-artifacts`.

Path inputs are constrained to `GITHUB_WORKSPACE`. Invalid booleans, unsupported modes, and workspace escapes fail closed.

Action report toggles override `boardguard.yml` report preferences. Reports are written only under `boardguard-results/`; SARIF upload and artifact upload are opt-in by input.

Outputs include total findings, severity counts, report paths, project count, KiCad CLI availability, ERC status, and DRC status.

Warn mode never fails because of findings. Enforce mode fails on high or critical findings.
