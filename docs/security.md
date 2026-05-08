# Security

BoardGuard defaults are local-only and offline.

- No external upload by default.
- No execution of arbitrary repository scripts.
- Repository content is treated as untrusted input.
- `kicad-cli` is invoked only with fixed argument arrays and a timeout.
- Secrets are not passed to KiCad CLI.
- GitHub token permissions in examples are minimal and explicit.
- Fork PR workflows do not use `pull_request_target`.
- SARIF upload is opt-in and requires `security-events: write`.
- Release automation prepares GitHub release assets only after release-please creates a release.

The first release candidate does not publish npm packages, containers, marketplace entries, VSIX files, Open VSX packages, or KiCad PCM packages.
