#!/usr/bin/env bash
# Deploys to the server: code to /srv/sponsored/src, compose.yml and the systemd timers next to it, then migrates,
# starts the site and gives it to the shared Caddy. Safe to run again. Touches nothing outside /srv/sponsored, its
# own systemd units and its own site file in /srv/edge/sites.
#   DEPLOY_HOST=<ssh alias> deploy/deploy.sh
set -euo pipefail
HOST=${DEPLOY_HOST:?set DEPLOY_HOST to the ssh alias of the server}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
# tar over ssh (the server has no rsync): unpack next to the old copy, then swap
COPYFILE_DISABLE=1 tar -C "$ROOT" --no-xattrs --exclude node_modules --exclude .git --exclude data --exclude .DS_Store \
  --exclude .nuxt --exclude .output --exclude CLAUDE.local.md -czf - . |
  ssh "$HOST" 'set -e; mkdir -p /srv/sponsored/data; rm -rf /srv/sponsored/src.new; mkdir /srv/sponsored/src.new;
    tar -xzf - -C /srv/sponsored/src.new; rm -rf /srv/sponsored/src; mv /srv/sponsored/src.new /srv/sponsored/src'
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /srv/sponsored
cp src/deploy/compose.yml compose.yml
if [ ! -f .env ]; then (umask 077; echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env); fi
# the site's read-only database user
grep -q '^WEB_DB_PASSWORD=' .env || echo "WEB_DB_PASSWORD=$(openssl rand -hex 24)" >> .env
docker compose build -q pipeline web
docker compose up -d --wait db
docker compose run --rm -T pipeline migrate </dev/null

# "site" reads everything and writes nothing; tables and views added later are readable too. The password goes in
# through the environment, never on a command line.
WEB_DB_PASSWORD=$(grep '^WEB_DB_PASSWORD=' .env | tail -1 | cut -d= -f2-) \
  docker compose exec -T -e WEB_DB_PASSWORD db psql -q -v ON_ERROR_STOP=1 -U sponsored -d sponsored <<'SQL'
\getenv pw WEB_DB_PASSWORD
select format('create role site login password %L', :'pw') where not exists (select from pg_roles where rolname = 'site') \gexec
alter role site with login password :'pw';
grant connect on database sponsored to site;
grant usage on schema public to site;
grant select on all tables in schema public to site;
alter default privileges for role sponsored in schema public grant select on tables to site;
SQL
docker compose up -d --wait web

# The shared front door: add our site file only if Caddy accepts the whole configuration with it, then reload.
caddy() { docker compose -f /srv/edge/compose.yml exec -T caddy caddy "$@"; }
cp src/deploy/caddy/sponsored.caddy /srv/edge/sites/sponsored.caddy
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  rm -f /srv/edge/sites/sponsored.caddy
  echo "Caddy rejected sites/sponsored.caddy: removed it, the front door is unchanged" >&2
  exit 1
fi
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

cp src/deploy/systemd/sponsored-* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sponsored-ingest.timer sponsored-registers.timer sponsored-discover.timer sponsored-backup.timer sponsored-digest.timer sponsored-extract.timer
systemctl list-timers 'sponsored-*' --no-pager
docker compose ps web
REMOTE
