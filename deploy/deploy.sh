#!/usr/bin/env bash
# Deploys the pipeline to the server: code to /srv/sponsored/src, compose.yml and the systemd timers next to it,
# then migrates. Safe to run again. Touches nothing outside /srv/sponsored and its own systemd units.
#   DEPLOY_HOST=<ssh alias> deploy/deploy.sh
set -euo pipefail
HOST=${DEPLOY_HOST:?set DEPLOY_HOST to the ssh alias of the server}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
# tar over ssh (the server has no rsync): unpack next to the old copy, then swap
COPYFILE_DISABLE=1 tar -C "$ROOT" --no-xattrs --exclude node_modules --exclude .git --exclude data --exclude .DS_Store \
  --exclude CLAUDE.local.md -czf - . |
  ssh "$HOST" 'set -e; mkdir -p /srv/sponsored/data; rm -rf /srv/sponsored/src.new; mkdir /srv/sponsored/src.new;
    tar -xzf - -C /srv/sponsored/src.new; rm -rf /srv/sponsored/src; mv /srv/sponsored/src.new /srv/sponsored/src'
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /srv/sponsored
cp src/deploy/compose.yml compose.yml
if [ ! -f .env ]; then (umask 077; echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env); fi
docker compose build -q pipeline
docker compose up -d --wait db
docker compose run --rm -T pipeline migrate </dev/null
cp src/deploy/systemd/sponsored-* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sponsored-ingest.timer sponsored-registers.timer sponsored-discover.timer sponsored-backup.timer
systemctl list-timers 'sponsored-*' --no-pager
REMOTE
