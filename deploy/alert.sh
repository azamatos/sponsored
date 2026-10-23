#!/usr/bin/env bash
# Tells the owner on Telegram that a sponsored-* unit failed (systemd OnFailure=, unit sponsored-alert@.service).
# The bot token and chat id live in /srv/sponsored/.env as TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; without them
# it only logs. Test: systemctl start sponsored-alert@test.service
set -uo pipefail
unit=${1:-unknown}
value() { grep -E "^$1=" /srv/sponsored/.env 2>/dev/null | tail -1 | cut -d= -f2-; }
token=$(value TELEGRAM_BOT_TOKEN)
chat=$(value TELEGRAM_CHAT_ID)
if [ -z "$token" ] || [ -z "$chat" ]; then
  echo "no TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in /srv/sponsored/.env: alert for $unit not sent"
  exit 0
fi
log=$(journalctl -u "$unit" -n 12 --no-pager -o cat 2>/dev/null | cut -c1-200)
text=$(printf 'Sponsored: %s failed\n\n%s' "$unit" "${log:-(no log lines)}" | head -c 3500)
# The token goes in through stdin, so it never shows in the process list.
printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
  curl -sS -m 20 -o /dev/null -w 'telegram: HTTP %{http_code}\n' -K - \
    --data-urlencode "chat_id=$chat" --data-urlencode "text=$text"
