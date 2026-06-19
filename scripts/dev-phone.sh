#!/usr/bin/env bash
# Start DealLock frontend + backend for phone testing on the same Wi‑Fi.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

if [[ -z "$LAN_IP" ]]; then
  echo "Could not detect LAN IP (en0/en1). Connect Wi‑Fi and retry."
  exit 1
fi

echo "LAN IP: $LAN_IP"

# Keep env files in sync with the current IP.
upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

upsert_env "$ROOT/frontend/.env.local" "VITE_API_URL" "http://${LAN_IP}:4000"
upsert_env "$ROOT/backend/.env.local" "FRONTEND_ORIGIN" "http://${LAN_IP}:5173"
upsert_env "$ROOT/backend/.env.local" "APP_URL" "http://${LAN_IP}:5173"

# Stop prior dev servers on these ports.
for port in 5173 4000; do
  pid="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
done

cd "$ROOT/backend"
nohup npm run dev > /tmp/deallock-backend.log 2>&1 &
echo "Backend starting (log: /tmp/deallock-backend.log)"

cd "$ROOT/frontend"
nohup npm run dev > /tmp/deallock-frontend.log 2>&1 &
echo "Frontend starting (log: /tmp/deallock-frontend.log)"

sleep 5

if curl -sf "http://${LAN_IP}:5173/" >/dev/null; then
  echo ""
  echo "Ready on your phone (same Wi‑Fi, not guest/cellular):"
  echo "  http://${LAN_IP}:5173"
  echo "  http://${LAN_IP}:5173/login"
else
  echo ""
  echo "Frontend not reachable yet. Check /tmp/deallock-frontend.log"
  tail -10 /tmp/deallock-frontend.log || true
  exit 1
fi
