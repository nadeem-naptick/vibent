# Production deploy notes — naptick-uat

The vibent-agentic prod box is **EC2 t3.medium** in `ap-south-1` at
`13.204.177.162`, SSH alias `naptick-uat` (user `ubuntu`). This directory
holds the box-side files we need to reproduce the setup if the instance
ever gets rebuilt.

The application code itself runs from `/home/ubuntu/vibent` (git clone of
this repo, `master` branch). The pieces below sit *outside* the app dir.

## Pieces this directory tracks

| File | Where it lives on the box | Owner |
|---|---|---|
| `vibent-tunnel.sh` | `/home/ubuntu/vibent-tunnel.sh` | `ubuntu` |
| `vibent-tunnel.service` | `/etc/systemd/system/vibent-tunnel.service` | `root` |

## What the tunnel service does

A free Cloudflare **quick tunnel** in front of `localhost:3001`. The wrapper
script grabs the random `*.trycloudflare.com` URL out of cloudflared's log,
rewrites `NEXTAUTH_URL` in `~/vibent/.env`, and `pm2 restart`s the app with
`--update-env`. Whenever cloudflared restarts, the URL changes and the wrapper
re-syncs everything.

To read the current URL at any time:
```
ssh naptick-uat 'grep NEXTAUTH_URL /home/ubuntu/vibent/.env'
```

Permanent URLs (no random) require either a registered domain in Cloudflare
DNS or a Cloudflare account using `*.cfargotunnel.com`. We're on the free
quick-tunnel path for now.

## One-time box setup (run after a fresh EC2)

```bash
# --- 1. cloudflared ---
cd /tmp
curl -fsSL --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# --- 2. 4 GB swap (t3.medium ships with none — kernel OOM-killed sshd before this) ---
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
echo "vm.swappiness=10" | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl -p /etc/sysctl.d/99-swap.conf

# --- 3. pm2 guardrail (cap Next.js at 1.5 GB so it auto-restarts before OOM) ---
HOME=/home/ubuntu pm2 restart vibent-agentic --max-memory-restart 1500M --update-env
HOME=/home/ubuntu pm2 save

# --- 4. install the tunnel service ---
cp deploy/vibent-tunnel.sh /home/ubuntu/vibent-tunnel.sh
chmod +x /home/ubuntu/vibent-tunnel.sh
sudo cp deploy/vibent-tunnel.service /etc/systemd/system/vibent-tunnel.service
sudo systemctl daemon-reload
sudo systemctl enable --now vibent-tunnel.service
```

## Already in place (don't redo)

- `pm2-ubuntu.service` (the standard pm2 systemd unit) is enabled, so
  pm2 resurrects vibent-agentic automatically on reboot.
- MongoDB is bound to `127.0.0.1` (was on `0.0.0.0` and got ransomed
  before that was fixed — see `/etc/mongod.conf`).

## Update flow (when shipping new code)

```bash
bash deploy/deploy.sh           # safe deploy — refuses if working tree is dirty
bash deploy/deploy.sh --dirty   # deploy uncommitted WIP anyway
```

That runs the full flow: master-branch check → local build → rsync → remote
`npm ci --omit=dev` → `pm2 restart vibent-agentic` → prints the current
tunnel URL. The build runs *locally* because t3.medium OOMs trying to do
`next build` in place — the swap protects the runtime, not heavy builds.
