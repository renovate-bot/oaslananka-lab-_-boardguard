# AGENTS.md

## This repo is a CI/CD mirror

Source of truth: oaslananka/boardguard
Do NOT push code changes here — this repo is downstream.
All code must originate from the personal repo.

## Control-plane
oaslananka-lab/_ops

## Before any PR work
Run diagnostics:
  gh workflow run .github/workflows/agent-pr-diagnostics.yml \
    --repo oaslananka-lab/_ops --ref main \
    -f target_owner=oaslananka-lab \
    -f target_repo=boardguard \
    -f pr_number={PR_NUMBER}

## Before any release
  gh workflow run .github/workflows/repo-release-plan.yml \
    --repo oaslananka-lab/_ops --ref main \
    -f target_owner=oaslananka-lab \
    -f target_repo=boardguard

## Merge rule
Squash only. Never merge without clean diagnostics.

## Operating contract
https://github.com/oaslananka-lab/_ops/blob/main/docs/agent-operating-contract.md
https://github.com/oaslananka-lab/_ops/blob/main/docs/architecture.md