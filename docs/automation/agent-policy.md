# Automation Policy

Repository automation must preserve the two-repository operating model:

- `oaslananka/boardguard` is the source/original content repository.
- `oaslananka-lab/boardguard` carries byte-equivalent project contents and is the guarded CI/CD, release, support, and security boundary.
- Package metadata, Action examples, support links, and release links point to `oaslananka-lab/boardguard`.
- CI, security scanning, release preparation, and artifact generation run only when `github.repository == 'oaslananka-lab/boardguard'`.

Rules:

- no auto-merge
- no auto-approve
- no force-push
- no production release from pull request code
- no registry publish in v0.1
- no execution of fork pull request code with secrets
- no `pull_request_target`
- no package, container, marketplace, or KiCad PCM publishing without a separate explicit release change
