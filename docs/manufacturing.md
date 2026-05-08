# Manufacturing Preflight

BoardGuard checks that release metadata exists before a board is treated as manufacturing-ready:

- board name
- revision
- output directory
- expected Gerber, drill, BOM, CPL, schematic PDF, PCB PDF, and STEP artifact flags

v0.1 does not generate production Gerbers by default. `--export-plan` reports the configured dry-run plan.
