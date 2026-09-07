#!/bin/bash
# Script to automate Git workflow: add, commit, pull, and push

set -e

REMOTE="new-origin"
BRANCH="main"

echo "📝 Adding changed files..."
git add templates/index.html index.html push_to_main.sh

# Commit message can be passed as argument, otherwise use default
COMMIT_MSG="${1:-"fix: resolve visualizer animation remaining in fullscreen on pause"}"

# Check if there are staged changes to commit
if git diff --cached --quiet; then
    echo "ℹ️ No staged changes to commit."
else
    echo "💾 Committing changes..."
    git commit -m "$COMMIT_MSG"
fi

echo "🔄 Pulling latest changes from remote with rebase and autostash..."
git pull $REMOTE $BRANCH --rebase --autostash

echo "🚀 Pushing to $REMOTE/$BRANCH..."
git push $REMOTE HEAD:$BRANCH

echo "✅ Git workflow successfully completed."
