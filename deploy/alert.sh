#!/usr/bin/env bash
# Tells the owner on Telegram that a sponsored-* unit failed (systemd OnFailure=, unit sponsored-alert@.service).
# Test: systemctl start sponsored-alert@test.service
set -uo pipefail
source "$(dirname "$0")/telegram.sh"
unit=${1:-unknown}
log=$(journalctl -u "$unit" -n 12 --no-pager -o cat 2>/dev/null | cut -c1-200)
telegram "$(printf '⚠️ Visaproof: %s failed\n\n%s' "$unit" "${log:-(no log lines)}")"
