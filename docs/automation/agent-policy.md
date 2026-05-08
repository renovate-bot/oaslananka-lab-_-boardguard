# Automation Policy

Repository automation must preserve the canonical repository as the only source of truth.

Rules:

- no auto-merge
- no auto-approve
- no force-push
- no production release from pull request code
- no registry publish in v0.1
- no execution of fork pull request code with secrets
- no `pull_request_target`

The showcase mirror has no CI/CD, release, package, or marketplace authority.
