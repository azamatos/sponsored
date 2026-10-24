# Sourced by alert.sh and digest.sh: telegram "<html>" sends a message to the owner in Telegram's HTML (<b>, <i>,
# <code>, <blockquote>); if Telegram refuses the markup, the same text goes again as plain text. The bot token and
# chat id live in /srv/sponsored/.env as TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; without them it only logs.
value() { grep -E "^$1=" /srv/sponsored/.env 2>/dev/null | tail -1 | cut -d= -f2-; }
esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
plain() { sed -e 's/<[^>]*>//g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g'; }
send() { # token chat text [parse_mode]
  local mode=()
  [ -n "${4:-}" ] && mode=(--data-urlencode "parse_mode=$4")
  # The token goes in through stdin, so it never shows in the process list.
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$1" |
    curl -sS -m 20 -o /dev/null -w '%{http_code}' -K - --data-urlencode "chat_id=$2" "${mode[@]}" \
      --data-urlencode "text=$3"
}
telegram() {
  local token chat code
  token=$(value TELEGRAM_BOT_TOKEN)
  chat=$(value TELEGRAM_CHAT_ID)
  if [ -z "$token" ] || [ -z "$chat" ]; then
    echo "no TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in /srv/sponsored/.env: not sent"
    printf '%s\n' "$1" | plain
    return 0
  fi
  code=$(send "$token" "$chat" "$1" HTML)
  [ "$code" = 200 ] || code=$(send "$token" "$chat" "$(printf '%s' "$1" | plain | head -c 4000)")
  echo "telegram: HTTP $code"
}
