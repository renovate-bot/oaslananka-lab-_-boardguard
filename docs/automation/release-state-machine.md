# Release State Machine

`scripts/release-state.mjs` inspects package version, release-please manifest version, changelog presence, local tags, GitHub Releases when available, open release pull requests when available, blockers, and the next safe command.

`safe_to_publish` is false by default. The first release candidate does not publish packages or containers.
