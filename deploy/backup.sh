#!/usr/bin/env bash
# Nightly database dump on the server, kept for 7 days in /srv/sponsored/backups (run by sponsored-backup.timer).
# Restore: docker compose exec -T db pg_restore -U sponsored -d sponsored --clean < backups/<file>.dump
set -euo pipefail
cd /srv/sponsored
mkdir -p backups
file="backups/sponsored-$(date -u +%F).dump"
docker compose exec -T db pg_dump -U sponsored -Fc sponsored >"$file.tmp"
mv "$file.tmp" "$file"
find backups -name 'sponsored-*.dump' -mtime +7 -delete
ls -lh "$file"
