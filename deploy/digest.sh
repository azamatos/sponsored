#!/usr/bin/env bash
# The morning summary on Telegram. The pipeline writes it (apps/pipeline/src/digest.ts) from the database and what
# only this script can see on the server: the newest backup, the disk, and the units that failed.
set -uo pipefail
source "$(dirname "$0")/telegram.sh"
cd /srv/sponsored

latest=$(ls -t backups/sponsored-*.dump 2>/dev/null | head -1)
backup=null
[ -n "$latest" ] && backup=$(printf '{"bytes":%s,"at":%s}' "$(stat -c %s "$latest")" "$(stat -c %Y "$latest")")
disk=$(df --output=pcent / | tail -1 | tr -d ' %')
failed=$(journalctl --since -24h -u 'sponsored-*' --no-pager -o cat 2>/dev/null | grep "Failed with result" | grep -vc alerttest)
failing=""
for f in state/failing/*; do
  [ -f "$f" ] && failing+=$(printf '{"unit":"%s","since":%s},' "$(basename "$f")" "$(cat "$f")")
done
host=$(printf '{"backup":%s,"disk":%s,"failedRuns":%s,"failing":[%s]}' "$backup" "${disk:-null}" "${failed:-0}" "${failing%,}")

msg=$(docker compose run --rm -T pipeline digest "$host" </dev/null 2>/dev/null) ||
  msg=$'⚠️ <b>Visaproof · 1 problem</b>\n\n🔴 <b>Database</b>\n→ The pipeline couldn\'t read it, so there is no summary today'
telegram "$msg"
