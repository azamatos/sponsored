#!/usr/bin/env bash
# Tells the owner on Telegram when a sponsored-* unit fails, and when it works again:
#   alert.sh failed <unit>      from OnFailure= (sponsored-alert@.service)
#   alert.sh recovered <unit>   from OnSuccess= (sponsored-recovered@.service); silent unless the unit had failed
# A failure leaves a mark with its time in /srv/sponsored/state/failing/: the next success reports the recovery
# once, and the morning summary lists the units still failing. Test: systemctl start sponsored-alert@test.service
set -uo pipefail
source "$(dirname "$0")/telegram.sh"
mode=${1:-failed}
unit=${2:-unknown}
name=${unit#sponsored-}
name=${name%.service}
mark=/srv/sponsored/state/failing/$unit
now=$(date +%s)
when() { date -u -d "@$1" '+%a %-d %b, %H:%M UTC'; }
span() { local m=$((($2 - $1) / 60)); if [ "$m" -ge 120 ]; then echo "$((m / 60)) h"; else echo "$m min"; fi; }

if [ "$mode" = recovered ]; then
  [ -f "$mark" ] || exit 0
  since=$(cat "$mark")
  rm -f "$mark"
  telegram "$(printf '✅ <b>Visaproof · %s works again</b>\n<i>%s · it had failed for %s, since %s</i>' \
    "$name" "$(when "$now")" "$(span "$since" "$now")" "$(when "$since")")"
  exit 0
fi

# What a failure means for the site, and what happens next without anyone doing anything.
case $name in
  ingest) means="Some job boards weren't read. Their roles stay as they were: nothing is closed by mistake." ;;
  extract) means="New postings wait for the next night. A usage limit clears by itself." ;;
  registers) means="The registers loaded before stay in use." ;;
  backup) means="No new backup tonight. The last 7 days' backups are kept." ;;
  discover) means="No new job boards this week. The known ones are still read." ;;
  digest) means="This morning's summary wasn't sent." ;;
  *) means="A test: nothing is wrong." ;;
esac
since=$now
if [[ $unit == *.service ]]; then
  mkdir -p "$(dirname "$mark")"
  [ -f "$mark" ] || echo "$now" >"$mark"
  since=$(cat "$mark")
  next=$(systemctl show "sponsored-$name.timer" -p NextElapseUSecRealtime --value 2>/dev/null)
  [ -n "$next" ] && next=$(date -u -d "$next" '+%a %-d %b, %H:%M UTC' 2>/dev/null)
  after="${next:+Runs again $next. }You'll get ✅ when it works again."
else
  after="Nothing: this was a test."
fi

# The log of this run only, without systemd's and Docker's own lines or stack frames.
id=$(systemctl show "$unit" -p InvocationID --value 2>/dev/null)
if [ -n "$id" ]; then
  raw=$(journalctl "_SYSTEMD_INVOCATION_ID=$id" --no-pager -o cat 2>/dev/null)
else
  raw=$(journalctl -u "$unit" -n 40 --no-pager -o cat 2>/dev/null)
fi
log=$(printf '%s\n' "$raw" | grep -v -E '^(sponsored-|Starting |Started |Finished |Failed to start | Container |\s+at )' |
  grep -v '^\s*$' | tail -12 | cut -c1-200)
error=$(printf '%s\n' "$log" | grep -E '(^|[^A-Za-z])(Error|error)([^A-Za-z]|$)' | tail -1)
[ -n "$error" ] || error=$(printf '%s\n' "$log" | tail -1)
again=""
[ "$since" -lt $((now - 60)) ] && again=" · failing since $(when "$since")"

telegram "🚨 <b>Visaproof · $name failed</b>
<i>$(when "$now")$again</i>

<b>Error</b>
<code>$(printf '%s' "${error:-no log lines}" | cut -c1-300 | esc)</code>

<b>What it means</b>
$means

<b>Next</b>
$after

<blockquote expandable>$(printf '%s' "${log:-no log lines}" | esc)</blockquote>"
