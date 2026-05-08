# Review Thread Gate

`scripts/check-review-threads.mjs` queries GitHub GraphQL `PullRequest.reviewThreads(first: 100)`.

It ignores resolved and outdated threads, blocks unresolved human review threads, blocks unresolved actionable automation review threads, writes `review-thread-summary.json`, and appends a Markdown job summary.

It does not resolve review threads, approve pull requests, merge pull requests, or alter repository state.
