# Testing

BoardGuard test layers:

- Unit tests for discovery, config validation, BOM parsing, pinmap validation, reporting, and CLI exit behavior.
- Golden fixture tests under `tests/fixtures`.
- SARIF shape validation through JSON parsing and stable rule metadata.
- Action metadata validation through `scripts/validate-action-metadata.mjs`.
- Local CI through `task ci` when Task is installed.

KiCad-backed checks are optional. Static tests pass without KiCad installed. To test KiCad locally:

```bash
boardguard detect
boardguard scan --path tests/fixtures/projects/safe-basic --require-kicad false
boardguard scan --path tests/fixtures/projects/safe-basic --require-kicad true
```
