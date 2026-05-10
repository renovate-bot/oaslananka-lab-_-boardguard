# CLI

Commands:

```bash
boardguard scan [path]
boardguard detect
boardguard rules
boardguard version
boardguard help
```

`scan` supports explicit project, config, report output paths, warn/enforce mode, KiCad CLI requirements, BOM input, pinmap input, and dry-run export plan output.

`--json`, `--sarif`, and `--markdown` write report files. Without an explicit file name they use `boardguard.json`, `boardguard.sarif`, and `boardguard.md` in the scan root. `--format` controls stdout.

`npx boardguard@<version> --help` and package installs use the `dist/cli/main.js` executable declared in `package.json`.

The CLI never executes target repository scripts and never requires network access.
