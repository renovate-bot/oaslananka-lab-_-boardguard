# Rules

| Rule | Severity | Detection | Maturity |
| --- | --- | --- | --- |
| BG-CONFIG-001 | high | `boardguard.yml` is unreadable or does not match the version 1 schema subset. | implemented |
| BG-PROJ-001 | high | No `.kicad_pro` found under the configured path. | implemented |
| BG-PROJ-002 | medium | Multiple `.kicad_pro` files found without explicit project selection. | implemented |
| BG-PROJ-003 | high | Associated schematic or board file is missing. | implemented |
| BG-PROJ-004 | high | KiCad project, schematic, or PCB file is unreadable, malformed, or suspiciously small. | implemented |
| BG-IO-TOO-LARGE | high | A design input exceeds the file-type-specific safety limit. | implemented |
| BG-KICAD-001 | medium or critical | `kicad-cli` is unavailable. Critical when KiCad is required. | implemented |
| BG-ERC-001 | high | KiCad ERC exits non-zero or reports violations. | partial |
| BG-DRC-001 | high | KiCad DRC exits non-zero or reports violations. | partial |
| BG-BOM-001 | medium | Component or BOM row is missing manufacturer, MPN, value, or footprint where parseable. | partial |
| BG-BOM-002 | high | Duplicate component designator found. | implemented |
| BG-MFG-001 | medium | Manufacturing release metadata is missing. | implemented |
| BG-MFG-002 | medium | Manufacturing expected artifact plan is incomplete. | implemented |
| BG-PIN-001 | high | Pinmap schema errors or pinmap nets missing from extracted schematic labels. | experimental |

File limits are type-specific: `.kicad_pro` is capped at 2 MiB, `.kicad_sch` at 50 MiB, `.kicad_pcb` at 250 MiB, and BOM CSV/TSV inputs at 50 MiB. Over-limit files produce `BG-IO-TOO-LARGE` instead of being treated as missing.

False positives are most likely in BOM and pinmap checks because KiCad libraries and naming conventions vary across teams. v0.1 intentionally does not call supplier APIs.
