#!/usr/bin/env bash
# One-command deploy to naptick-uat.
#
#   bash deploy/deploy.sh           # safe deploy (refuses dirty tree)
#   bash deploy/deploy.sh --dirty   # deploy WIP changes anyway
#
# What it does:
#   1. cd to repo root, sanity-check we're on master with a clean tree
#   2. npm run build locally  (t3.medium can't build in-place — OOM)
#   3. rsync the runtime files to /home/ubuntu/vibent
#   4. npm ci --omit=dev + pm2 restart vibent-agentic on the box
#   5. probe the tunnel URL from .env and report it back

set -euo pipefail

REMOTE="naptick-uat"
REMOTE_DIR="/home/ubuntu/vibent"
APP_NAME="vibent-agentic"

ALLOW_DIRTY=0
for arg in "$@"; do
  case "$arg" in
    --dirty) ALLOW_DIRTY=1 ;;
    -h|--help)
      sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

# ----- 1. pre-flight checks --------------------------------------------------
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
  echo "✗ on branch '$BRANCH' — switch to master first (or commit a branch deploy explicitly)"
  exit 1
fi

if [ "$ALLOW_DIRTY" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree has uncommitted changes:"
  git status -s
  echo
  echo "  commit them first, or rerun with --dirty to deploy WIP."
  exit 1
fi

COMMIT=$(git rev-parse --short HEAD)
SUBJECT=$(git log -1 --pretty=%s)
echo "→ deploying $COMMIT  $SUBJECT"
echo

# ----- 2. local build --------------------------------------------------------
# Wipe .next first so Turbopack dev artifacts (from `npm run dev`) don't
# collide with `next build`'s rollup output. Symptom of the collision:
# "Cannot find module '../chunks/ssr/[turbopack]_runtime.js'" during build.
echo "→ clearing .next"
rm -rf .next
echo "→ local build"
npm run build

# ----- 3. rsync to box -------------------------------------------------------
echo
echo "→ rsync to $REMOTE:$REMOTE_DIR"
rsync -az --delete \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.env \
  --exclude='.env.*' \
  --exclude='.next/cache' \
  --exclude='*.log' \
  --exclude=.DS_Store \
  --exclude=tsconfig.tsbuildinfo \
  ./ "$REMOTE:$REMOTE_DIR/"

# ----- 4. remote install + restart -------------------------------------------
echo
echo "→ remote npm ci + pm2 restart"
ssh "$REMOTE" "cd $REMOTE_DIR && npm ci --omit=dev --no-audit --no-fund && HOME=/home/ubuntu pm2 restart $APP_NAME --update-env"

# ----- 5. report current tunnel URL ------------------------------------------
echo
URL=$(ssh "$REMOTE" "grep '^NEXTAUTH_URL=' $REMOTE_DIR/.env | sed 's/^NEXTAUTH_URL=//'")
echo "✓ deployed $COMMIT"
echo "  prod URL: $URL"
