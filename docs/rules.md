# Rules

| Rule | Severity | Detection | Maturity |
| --- | --- | --- | --- |
| BG-PROJ-001 | high | No `.kicad_pro` found under the configured path. | implemented |
| BG-PROJ-002 | medium | Multiple `.kicad_pro` files found without explicit project selection. | implemented |
| BG-PROJ-003 | high | Associated schematic or board file is missing. | implemented |
| BG-PROJ-004 | high | KiCad project, schematic, or PCB file is unreadable, malformed, or suspiciously small. | implemented |
| BG-KICAD-001 | medium or critical | `kicad-cli` is unavailable. Critical when KiCad is required. | implemented |
| BG-ERC-001 | high | KiCad ERC exits non-zero or reports violations. | partial |
| BG-DRC-001 | high | KiCad DRC exits non-zero or reports violations. | partial |
| BG-BOM-001 | medium | Component or BOM row is missing manufacturer, MPN, value, or footprint where parseable. | partial |
| BG-BOM-002 | high | Duplicate component designator found. | implemented |
| BG-MFG-001 | medium | Manufacturing release metadata is missing. | implemented |
| BG-MFG-002 | medium | Manufacturing expected artifact plan is incomplete. | implemented |
| BG-PIN-001 | high | Pinmap schema errors or pinmap nets missing from extracted schematic labels. | experimental |

False positives are most likely in BOM and pinmap checks because KiCad libraries and naming conventions vary across teams. v0.1 intentionally does not call supplier APIs.
