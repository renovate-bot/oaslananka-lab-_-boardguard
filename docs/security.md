# Security

BoardGuard defaults are local-only and offline.

- No external upload by default.
- No execution of arbitrary repository scripts.
- Repository content is treated as untrusted input.
- GitHub Action file inputs are resolved inside `GITHUB_WORKSPACE` and reject workspace escapes.
- `kicad-cli` is invoked only with fixed argument arrays, bounded output capture, and a timeout.
- Recursive scans skip common dependency/cache directories and apply depth, count, size, extension, and symlink limits.
- Secrets are not passed to KiCad CLI.
- GitHub token permissions in examples are minimal and explicit.
- Fork PR workflows do not use `pull_request_target`.
- SARIF upload is opt-in and requires `security-events: write`.
- Release automation prepares GitHub release assets only after release-please creates a release.

The first release candidate does not publish npm packages, containers, marketplace entries, VSIX files, Open VSX packages, or KiCad PCM packages.
