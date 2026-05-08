# Automation Policy

Repository automation must preserve the two-repository operating model:

- `oaslananka/boardguard` is the source repository used for package metadata, issues, and public project URLs.
- `oaslananka-lab/boardguard` carries the same project contents and is the guarded CI/CD execution target.
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
