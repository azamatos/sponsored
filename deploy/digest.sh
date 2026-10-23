#!/usr/bin/env bash
# The morning summary on Telegram: what the last 24 hours did (from the database), plus the backup and the disk.
# Problems come first and change the header, so a glance is enough; no message at all means the server is down.
set -uo pipefail
source "$(dirname "$0")/telegram.sh"
cd /srv/sponsored
lines=$(docker compose run --rm -T pipeline digest </dev/null 2>/dev/null) || lines="! the pipeline couldn't read the database"

backup=$(ls -t backups/sponsored-*.dump 2>/dev/null | head -1)
if [ -n "$backup" ] && [ "$(find "$backup" -mmin -1500 | wc -l)" -gt 0 ]; then
  lines+=$'\n'"Backup: $(du -h "$backup" | cut -f1) ($(basename "$backup" .dump | sed 's/sponsored-//'))"
else
  lines+=$'\n'"! backup: none in the last 25 h"
fi
disk=$(df --output=pcent / | tail -1 | tr -d ' %')
[ "$disk" -ge 85 ] && lines+=$'\n'"! disk: ${disk}% used" || lines+=$'\n'"Disk: ${disk}% used"
failures=$(journalctl --since -24h -u 'sponsored-*' --no-pager -o cat 2>/dev/null | grep "Failed with result" | grep -vc alerttest)
[ "$failures" -gt 0 ] && lines+=$'\n'"! ${failures} failed run(s) in 24 h (each sent an alert)"

problems=$(printf '%s\n' "$lines" | grep '^!' | sed 's/^! */• /')
rest=$(printf '%s\n' "$lines" | grep -v '^!')
if [ -n "$problems" ]; then
  telegram "$(printf '⚠️ Visaproof, last 24 h: %s problem(s)\n%s\n\n%s' "$(printf '%s\n' "$problems" | wc -l | tr -d ' ')" "$problems" "$rest")"
else
  telegram "$(printf '✅ Visaproof, last 24 h: all good\n%s' "$rest")"
fi
