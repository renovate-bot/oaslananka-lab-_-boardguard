# GitHub Action

The Action runs on Node 24 and writes reports under `boardguard-results/`.

Inputs include `path`, `project`, `config`, `mode`, `require-kicad`, `kicad-cli`, `bom`, `pinmap`, report toggles, `upload-sarif`, and `upload-artifacts`.

Outputs include total findings, severity counts, report paths, project count, KiCad CLI availability, ERC status, and DRC status.

Warn mode never fails because of findings. Enforce mode fails on high or critical findings.
