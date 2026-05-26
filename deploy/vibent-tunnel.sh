#!/usr/bin/env bash
set -e
LOG=/home/ubuntu/vibent-tunnel.log
ENV_FILE=/home/ubuntu/vibent/.env
APP=vibent-agentic
CLOUDFLARED=/usr/local/bin/cloudflared
PM2=/usr/bin/pm2

# Fresh log each run so we never read a stale URL
: > "$LOG"

"$CLOUDFLARED" tunnel --url http://localhost:3001 >> "$LOG" 2>&1 &
CF_PID=$!

URL=""
for _ in $(seq 1 60); do
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "[tunnel] FAILED to detect URL within 60s — see $LOG"
  kill "$CF_PID" 2>/dev/null || true
  exit 1
fi

echo "[tunnel] URL: $URL"

CURRENT=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | sed "s/^NEXTAUTH_URL=//")
if [ "$CURRENT" != "$URL" ]; then
  echo "[tunnel] Updating NEXTAUTH_URL ($CURRENT -> $URL)"
  sed -i.bak "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$URL|" "$ENV_FILE"
  HOME=/home/ubuntu "$PM2" restart "$APP" --update-env > /dev/null
fi

wait "$CF_PID"
