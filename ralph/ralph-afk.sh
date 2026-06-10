#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# Start headless server to avoid cold boot per iteration
opencode serve --port 4096 &
SERVER_PID=$!
sleep 3

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

for ((i=1; i<=$1; i++)); do
  ISSUE=$(gh issue list --repo knekvasil/gin13 --label "ready-for-agent" --json number,title --jq 'sort_by(.number) | .[0]')

  if [ -z "$ISSUE" ] || [ "$ISSUE" = "null" ]; then
    echo "COMPLETE - no issues remaining after $i iterations."
    exit 0
  fi

  NUMBER=$(echo "$ISSUE" | jq -r '.number')
  TITLE=$(echo "$ISSUE" | jq -r '.title')

  echo "=== Iteration $i: Issue #$NUMBER - $TITLE ==="

  BODY=$(gh issue view "$NUMBER" --repo knekvasil/gin13 --json body --jq '.body')

  opencode run --attach http://localhost:4096 \
    --dangerously-skip-permissions \
    "Implement issue #$NUMBER - $TITLE

$BODY

Workflow rules:
- Follow test-driven development: write ONE test (RED), then implement (GREEN), repeat.
- Do NOT write all tests upfront. One test at a time.
- Do NOT try to load any skills. Use the tools available to you directly.
- Keep changes minimal — implement only what the current test requires.
- Run feedback loops (tests, typecheck) after each change.
- Do NOT commit — the script handles commits externally.
- When all acceptance criteria are met, output DONE." || {
    echo "FAILURE: opencode crashed on issue #$NUMBER"
    gh issue edit "$NUMBER" --repo knekvasil/gin13 --add-label "needs-info"
    echo "- [FAIL] #$NUMBER - $TITLE (opencode crashed)" >> ralph/progress.md
    exit 1
  }

  echo "=== Feedback loops ==="
  npm run test || {
    echo "FAILURE: tests failed on issue #$NUMBER"
    gh issue edit "$NUMBER" --repo knekvasil/gin13 --add-label "needs-info"
    echo "- [FAIL] #$NUMBER - $TITLE (tests failing)" >> ralph/progress.md
    exit 1
  }
  npm run typecheck || {
    echo "FAILURE: typecheck failed on issue #$NUMBER"
    gh issue edit "$NUMBER" --repo knekvasil/gin13 --add-label "needs-info"
    echo "- [FAIL] #$NUMBER - $TITLE (typecheck failing)" >> ralph/progress.md
    exit 1
  }

  git add -A
  git commit -m "Implements #$NUMBER - $TITLE"
  git push

  SHA=$(git rev-parse --short HEAD)
  AC=$(echo "$BODY" | sed -n '/^## Acceptance criteria/,/^## /p' | grep '^- \[' | sed 's/^- \[.\] /- /')

  gh issue edit "$NUMBER" --repo knekvasil/gin13 --remove-label "ready-for-agent"
  gh issue close "$NUMBER" --repo knekvasil/gin13 --comment "Implemented in $SHA.

$AC"

  echo "- [x] #$NUMBER - $TITLE" >> ralph/progress.md
done

echo "=== Reached $1 iterations. Exiting. ==="
