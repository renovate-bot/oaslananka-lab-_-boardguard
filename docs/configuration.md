# Configuration

`boardguard.yml` uses `version: 1`.

The JSON Schema is available at `boardguard.schema.json`. Unknown top-level and critical nested keys are rejected so misspelled release or policy settings do not silently downgrade validation.

Main sections:

- `project`: explicit KiCad project and KiCad CLI requirement.
- `reports`: JSON, SARIF, and Markdown preferences.
- `manufacturing`: board metadata and expected artifacts.
- `bom`: optional CSV input and required field names.
- `firmware`: optional pinmap path.
- `rules`: severity overrides using `critical`, `high`, `medium`, `low`, `info`, `error`, `warning`, or `off`.
