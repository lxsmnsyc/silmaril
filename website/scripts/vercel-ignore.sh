#!/bin/sh
# Vercel "Ignored Build Step". It runs in the website folder.
# Exit 1 builds the deployment, exit 0 skips it.

# Production: always build main.
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  exit 1
fi

# Previews: only for branches with an open pull request.
if [ -z "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
  echo "Skipped: not main and no pull request."
  exit 0
fi

# Only when the pull request changes the website. Vercel clones shallowly,
# so fetch main to find where the branch started. If that fails, build.
if git fetch --quiet --depth=200 origin main 2>/dev/null; then
  base=$(git merge-base FETCH_HEAD HEAD 2>/dev/null)
  if [ -n "$base" ] && git diff --quiet "$base" HEAD -- .; then
    echo "Skipped: the pull request does not change the website."
    exit 0
  fi
fi

exit 1
