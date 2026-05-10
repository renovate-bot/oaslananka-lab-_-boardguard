# Release

BoardGuard uses release-please manifest mode.

Version sources:

- Conventional Commit history
- SemVer
- `release-please-config.json`
- `.release-please-manifest.json`
- release-please outputs

Manual version inputs, manual tags, manual GitHub Releases, and manual changelog edits for released entries are not part of the release model.

The package version is managed by release-please. The release workflow is guarded to `oaslananka-lab/boardguard` and does not publish packages in the current release model. When release-please creates a release, GitHub Actions builds assets, validates package layout, runs CLI and Action smoke tests, writes checksums, prepares a CycloneDX SBOM with pinned official tooling, creates GitHub artifact attestations, and attaches assets to the GitHub Release.

npm publishing is intentionally not enabled. The preferred future model is npm Trusted Publishing with GitHub OIDC and an approval-protected environment. A token fallback must be environment-scoped and explicitly approved before use.

The org repository uses a selected-actions policy with full-SHA pinning. Keep GitHub-owned actions enabled and allow only the external actions required by release and advisory security automation:

- `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7`
- `actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26`
- `ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a`

Keep default workflow token permissions read-only, and enable workflow pull request creation so release-please can open release PRs. BoardGuard workflows must not submit approving reviews.
