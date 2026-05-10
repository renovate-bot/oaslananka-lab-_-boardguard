# Release State Machine

`scripts/release-state.mjs` inspects the repository identity, package name, package version, release-please manifest version, generated runtime version, changelog presence, local tags, GitHub Releases when available, live npm version when available, open release pull requests when available, release workflow state, blockers, and the next safe command.

`safe_to_publish` is false by default. The first release candidate does not publish packages or containers.
