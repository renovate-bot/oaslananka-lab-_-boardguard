# Automation Policy

Repository automation must preserve the two-repository operating model:

- `oaslananka-lab/boardguard` is the canonical project repository and the guarded CI/CD, release, support, and security boundary.
- `oaslananka/boardguard` may be maintained as a byte-equivalent showcase mirror when explicit mirror automation is approved.
- Package metadata, Action examples, support links, and release links point to `oaslananka-lab/boardguard`.
- CI, security scanning, release preparation, and artifact generation run only when `github.repository == 'oaslananka-lab/boardguard'`.

Rules:

- no auto-merge
- no auto-approve
- no force-push
- no production release from pull request code
- no registry publish in the current release model
- no execution of fork pull request code with secrets
- no `pull_request_target`
- no package, container, marketplace, or KiCad PCM publishing without a separate explicit release change
