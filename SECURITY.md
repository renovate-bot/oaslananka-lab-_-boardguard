# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories:

https://github.com/oaslananka-lab/boardguard/security/advisories/new

Do not open a public issue for a suspected vulnerability.

## Security model

BoardGuard is designed for local-only hardware repository analysis. It treats KiCad projects, schematics, PCB files, BOMs, and pinmaps as untrusted input. It does not execute repository scripts or call supplier APIs by default.

The intended default posture is read-only analysis. Any future write, publish, network, supplier API, or destructive operation must be explicitly documented, tested, and gated in CI.
