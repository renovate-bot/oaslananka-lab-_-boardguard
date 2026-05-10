import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (!token || !repository || !eventPath) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_EVENT_PATH are required.");
}

const event = JSON.parse(await fs.readFile(eventPath, "utf8"));
const pullNumber = event.pull_request?.number;
if (!pullNumber) {
  process.stdout.write("No pull request context; review-thread gate skipped.\n");
  process.exit(0);
}

const [owner, name] = repository.split("/");
const query = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 20) {
            nodes {
              body
              author {
                login
                __typename
              }
            }
          }
        }
      }
    }
  }
}`;

const threads = [];
let cursor = null;
const maxPages = 25;
for (let page = 0; page < maxPages; page += 1) {
  const payload = await graphql({ owner, name, number: pullNumber, cursor });
  const connection = payload.data.repository.pullRequest.reviewThreads;
  threads.push(...connection.nodes);
  if (!connection.pageInfo.hasNextPage) {
    cursor = null;
    break;
  }
  cursor = connection.pageInfo.endCursor;
}
if (cursor) {
  throw new Error(`Review thread pagination exceeded ${maxPages} pages; refusing to ignore remaining threads.`);
}
const blocking = [];
for (const thread of threads) {
  if (thread.isResolved || thread.isOutdated) {
    continue;
  }
  const comments = thread.comments.nodes;
  const human = comments.some((comment) => comment.author?.__typename !== "Bot");
  const actionableBot = comments.some((comment) => comment.author?.__typename === "Bot" && /must|should|fix|fail|error|security|vulnerab|request changes/i.test(comment.body));
  if (human || actionableBot) {
    blocking.push({
      id: thread.id,
      path: thread.path,
      line: thread.line,
      reason: human ? "unresolved human review thread" : "unresolved actionable bot review thread"
    });
  }
}

const summary = {
  pull_number: pullNumber,
  unresolved_blocking_threads: blocking.length,
  blocking_threads: blocking
};
await fs.writeFile("review-thread-summary.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
const markdown = [
  "# Review Thread Gate",
  "",
  `Blocking unresolved threads: ${blocking.length}`,
  "",
  ...blocking.map((thread) => `- ${thread.reason}: ${thread.path}:${thread.line ?? 1}`)
].join("\n");
if (summaryPath) {
  await fs.appendFile(summaryPath, `${markdown}\n`, "utf8");
}
process.stdout.write(`${markdown}\n`);
if (blocking.length > 0) {
  process.exitCode = 1;
}

async function graphql(variables) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "boardguard-review-thread-gate"
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors));
  }
  return payload;
}
