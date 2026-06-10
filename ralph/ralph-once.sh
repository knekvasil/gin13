#!/bin/bash
set -e

ISSUE=$(gh issue list --repo knekvasil/gin13 --label "ready-for-agent" --json number,title --jq '.[0]')

if [ -z "$ISSUE" ] || [ "$ISSUE" = "null" ]; then
  echo "No ready-for-agent issues remaining."
  exit 0
fi

NUMBER=$(echo "$ISSUE" | jq -r '.number')
TITLE=$(echo "$ISSUE" | jq -r '.title')

echo "=== Issue #$NUMBER - $TITLE ==="

BODY=$(gh issue view "$NUMBER" --repo knekvasil/gin13 --json body --jq '.body')

opencode run "Implement issue #$NUMBER - $TITLE

$BODY

Acceptance criteria must be met. Run tests and typecheck before finishing."

echo "=== Feedback loops ==="
npm run test || { echo "FAILURE: tests failed on issue #$NUMBER"; gh issue edit "$NUMBER" --repo knekvasil/gin13 --add-label "needs-info"; echo "- [FAIL] #$NUMBER - $TITLE (tests failing)" >> ralph/progress.md; exit 1; }
npm run typecheck || { echo "FAILURE: typecheck failed on issue #$NUMBER"; gh issue edit "$NUMBER" --repo knekvasil/gin13 --add-label "needs-info"; echo "- [FAIL] #$NUMBER - $TITLE (typecheck failing)" >> ralph/progress.md; exit 1; }

git add -A

SUMMARY=$(git log --oneline -1 --stat HEAD 2>/dev/null || echo "New implementation")

git commit -m "Implements #$NUMBER - $TITLE"

gh issue close "$NUMBER" --repo knekvasil/gin13 --comment "Implemented.

$SUMMARY"

echo "- [x] #$NUMBER - $TITLE" >> ralph/progress.md

echo "=== Done ==="
