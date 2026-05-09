# Release

BoardGuard uses release-please manifest mode.

Version sources:

- Conventional Commit history
- SemVer
- `release-please-config.json`
- `.release-please-manifest.json`
- release-please outputs

Manual version inputs, manual tags, manual GitHub Releases, and manual changelog edits for released entries are not part of the release model.

The package version is managed by release-please. The release workflow is guarded to `oaslananka-lab/boardguard` and does not publish packages in the current release model. When release-please creates a release, GitHub Actions builds assets, validates package layout, runs CLI and Action smoke tests, writes checksums, prepares SBOM/provenance artifacts, and attaches assets to the GitHub Release.

The org repository uses a selected-actions policy with full-SHA pinning. Keep GitHub-owned actions enabled and allow only the external actions required by release and advisory security automation:

- `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7`
- `ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a`
