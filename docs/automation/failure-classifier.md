# Failure Classifier

`scripts/classify-gh-failure.mjs` classifies workflow logs into known buckets:

- workflow syntax or actionlint
- zizmor issue
- secret scan finding
- CodeQL finding
- dependency audit finding
- test, typecheck, lint, package build, metadata, SARIF, config, KiCad, fixture, release, flaky infrastructure, or unknown

The script is read-only and intended to speed up triage.
