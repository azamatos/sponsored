# Sourced by alert.sh and digest.sh: telegram "<text>" sends a message to the owner. The bot token and chat id live
# in /srv/sponsored/.env as TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; without them it only logs.
value() { grep -E "^$1=" /srv/sponsored/.env 2>/dev/null | tail -1 | cut -d= -f2-; }
telegram() {
  local token chat
  token=$(value TELEGRAM_BOT_TOKEN)
  chat=$(value TELEGRAM_CHAT_ID)
  if [ -z "$token" ] || [ -z "$chat" ]; then
    echo "no TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in /srv/sponsored/.env: not sent"
    return 0
  fi
  # The token goes in through stdin, so it never shows in the process list.
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -sS -m 20 -o /dev/null -w 'telegram: HTTP %{http_code}\n' -K - \
      --data-urlencode "chat_id=$chat" --data-urlencode "text=$(printf '%s' "$1" | head -c 3500)"
}
