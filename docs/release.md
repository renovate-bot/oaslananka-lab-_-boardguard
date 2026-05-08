# Release

BoardGuard uses release-please manifest mode.

Version sources:

- Conventional Commit history
- SemVer
- `release-please-config.json`
- `.release-please-manifest.json`
- release-please outputs

Manual version inputs, manual tags, manual GitHub Releases, and manual changelog edits for released entries are not part of the release model.

The package version is managed by release-please. The release workflow is guarded to `oaslananka-lab/boardguard` and does not publish packages in v0.1. When release-please creates a release, GitHub Actions builds assets, writes checksums, prepares SBOM/provenance artifacts, and attaches assets to the GitHub Release.
