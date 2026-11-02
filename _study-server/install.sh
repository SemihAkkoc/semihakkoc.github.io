#!/usr/bin/env bash
# Installs the study log server on this Linux machine and publishes it to the
# tailnet only. Safe to run again. Data lives in ~/.local/share/study-log.
set -euo pipefail

LOCAL_PORT=8787
TAILNET_PORT=8443 # not 443, so an existing `tailscale serve` site is left alone
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as your normal user, not root. It uses sudo only where needed." >&2
  exit 1
fi
for tool in python3 tailscale systemctl; do
  command -v "$tool" >/dev/null || { echo "Missing required command: $tool" >&2; exit 1; }
done

# Do not take over a port that is already serving something else
existing="$(tailscale serve status 2>/dev/null || true)"
if printf '%s\n' "$existing" | grep -q ":$TAILNET_PORT" && ! printf '%s\n' "$existing" | grep -q "127.0.0.1:$LOCAL_PORT"; then
  echo "tailscale serve already uses port $TAILNET_PORT for something else:" >&2
  printf '%s\n' "$existing" >&2
  echo "Nothing was changed. Free that port or edit TAILNET_PORT (443, 8443 or 10000) in this script." >&2
  exit 1
fi

echo "Installing the server..."
install -Dm755 "$HERE/study_server.py" "$HOME/.local/lib/study-log/study_server.py"
install -Dm644 "$HERE/study-log.service" "$HOME/.config/systemd/user/study-log.service"

# Linger keeps user services running with nobody logged in, and starts them at boot
loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable study-log.service
systemctl --user restart study-log.service

echo "Waiting for it to answer..."
python3 - "$LOCAL_PORT" <<'PY'
import sys, time, urllib.request
url = "http://127.0.0.1:%s/api/health" % sys.argv[1]
for _ in range(20):
    try:
        urllib.request.urlopen(url, timeout=1)
        sys.exit(0)
    except OSError:
        time.sleep(0.5)
sys.exit("The server did not start. See: journalctl --user -u study-log -n 50")
PY

echo "Publishing to the tailnet (sudo may ask for your password)..."
sudo tailscale serve --bg --https="$TAILNET_PORT" "http://127.0.0.1:$LOCAL_PORT"

host="$(tailscale status --json | python3 -c 'import json, sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
address="https://$host:$TAILNET_PORT"

echo
echo "Done. Paste this into 'Connect server' on the study page, on each device:"
echo
echo "    $address"
echo
echo "Check it from another device on the tailnet: curl $address/api/health"
