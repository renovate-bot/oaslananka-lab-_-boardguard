# Configuration

`boardguard.yml` uses `version: 1`.

The JSON Schema is available at `boardguard.schema.json`. Unknown top-level and critical nested keys are rejected so misspelled release or policy settings do not silently downgrade validation.

Main sections:

- `project`: explicit KiCad project and KiCad CLI requirement.
- `reports`: JSON, SARIF, and Markdown preferences.
- `manufacturing`: board metadata and expected artifacts.
- `bom`: optional CSV input and required field names.
- `firmware`: optional pinmap path.
- `kicad`: optional KiCad CLI strict-check preferences.
- `rules`: severity overrides using `critical`, `high`, `medium`, `low`, `info`, `error`, `warning`, or `off`.

Output precedence is deterministic:

1. CLI flags.
2. GitHub Action inputs.
3. `boardguard.yml`.
4. Defaults.

When `reports.json`, `reports.sarif`, or `reports.markdown` is true, the CLI writes `boardguard.json`, `boardguard.sarif`, or `boardguard.md` unless a CLI output path overrides it. Action inputs are explicit top-level overrides and write under `boardguard-results/`.

Rule values of `off` suppress findings for that rule. `error` maps to high severity and `warning` maps to medium severity. Unknown rule IDs are rejected.

KiCad options are feature-detected against the installed CLI help text. KiCad 10 can use strict DRC/ERC flags, while older supported installations run only the flags they advertise.
