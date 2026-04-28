#!/usr/bin/env bash
# Manual demo gate — run after `pnpm -r build`. Not part of automated CI.
#
# Usage:
#   chmod +x scripts/fleet-smoke.sh
#   ./scripts/fleet-smoke.sh
#
# Starts operator + 3 runtimes (alpha/beta/gamma), fires 3 distributes + 1 revoke,
# then prints the /logs transcript and /runtimes state.
#
# Phase 3 ROADMAP success criteria covered:
#   1. Three runtimes boot, generate keypairs, register  (alpha/beta/gamma registration)
#   2. Distribute happy path runs end-to-end             (three POST /distribute calls)
#   3. Cloned runtime rejected; visible in /logs         (not automated here — see iden-02 tests)
#   4. Revoked runtime fails next handshake              (POST /revoke for beta)
#   5. /logs broadcasts in real time over WS ITransport  (/tmp/sonar-logs.log transcript)
#   6. Operator never persists private keys              (see oper-05.invariant.test.ts)

set -euo pipefail

OPERATOR_PORT="${OPERATOR_PORT:-8787}"
OPERATOR_URL="http://localhost:${OPERATOR_PORT}"
LOG_FILE="/tmp/sonar-logs.log"
OP_PID=""
FLEET_PID=""
SUB_PID=""

cleanup() {
  echo ""
  echo "=== Cleanup ==="
  [ -n "$SUB_PID" ] && kill "$SUB_PID" 2>/dev/null || true
  [ -n "$FLEET_PID" ] && kill "$FLEET_PID" 2>/dev/null || true
  [ -n "$OP_PID" ] && kill "$OP_PID" 2>/dev/null || true
  echo "All processes stopped."
}
trap cleanup EXIT

# ── Step 1: Start Operator ────────────────────────────────────────────────────
echo "=== Starting Operator on port ${OPERATOR_PORT} ==="
pnpm --filter @sonar/operator start > /tmp/sonar-operator.log 2>&1 &
OP_PID=$!
echo "  Operator PID: ${OP_PID}"

# Wait until operator is ready (max 10s)
MAX_WAIT=10
WAITED=0
until curl -sf "${OPERATOR_URL}/runtimes" > /dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Operator did not become ready within ${MAX_WAIT}s"
    cat /tmp/sonar-operator.log
    exit 1
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done
echo "  Operator ready after ${WAITED}s"

# ── Step 2: Start Fleet (3 runtimes) ─────────────────────────────────────────
echo ""
echo "=== Starting fleet (alpha/beta/gamma) ==="
pnpm dev:fleet > /tmp/sonar-fleet.log 2>&1 &
FLEET_PID=$!
echo "  Fleet PID: ${FLEET_PID}"

# ── Step 3: Open /logs subscriber ────────────────────────────────────────────
echo ""
echo "=== Opening /logs subscriber ==="
: > "$LOG_FILE"

# Use a minimal Node.js WebSocket client to subscribe to /logs
node -e "
  const WebSocket = require('ws');
  const ws = new WebSocket('ws://localhost:${OPERATOR_PORT}/logs');
  ws.on('message', (raw) => {
    const line = raw.toString();
    process.stdout.write(line + '\n');
    require('fs').appendFileSync('${LOG_FILE}', line + '\n');
  });
  ws.on('error', (err) => process.stderr.write('logs-sub error: ' + err.message + '\n'));
  ws.on('close', () => process.stderr.write('logs-sub closed\n'));
" &
SUB_PID=$!
echo "  /logs subscriber PID: ${SUB_PID}"

# ── Step 4: Wait for runtimes to register (3s) ───────────────────────────────
echo ""
echo "=== Waiting 3s for runtimes to register ==="
sleep 3

echo ""
echo "=== Current runtimes ==="
curl -s "${OPERATOR_URL}/runtimes" | python3 -m json.tool 2>/dev/null || curl -s "${OPERATOR_URL}/runtimes"

# ── Step 5: Fire 3 distributes ───────────────────────────────────────────────
echo ""
echo "=== Distributing payload to alpha ==="
curl -sf -X POST \
  -H 'Content-Type: application/json' \
  -d '{"runtimeId":"alpha","payload":"VEVTVA=="}' \
  "${OPERATOR_URL}/distribute" | python3 -m json.tool 2>/dev/null || true

echo ""
echo "=== Distributing payload to beta ==="
curl -sf -X POST \
  -H 'Content-Type: application/json' \
  -d '{"runtimeId":"beta","payload":"VEVTVA=="}' \
  "${OPERATOR_URL}/distribute" | python3 -m json.tool 2>/dev/null || true

echo ""
echo "=== Distributing payload to gamma ==="
curl -sf -X POST \
  -H 'Content-Type: application/json' \
  -d '{"runtimeId":"gamma","payload":"VEVTVA=="}' \
  "${OPERATOR_URL}/distribute" | python3 -m json.tool 2>/dev/null || true

# ── Step 6: Revoke beta ───────────────────────────────────────────────────────
echo ""
echo "=== Revoking beta ==="
curl -sf -X POST \
  -H 'Content-Type: application/json' \
  -d '{"runtimeId":"beta","reason":"demo_revoke"}' \
  "${OPERATOR_URL}/revoke" | python3 -m json.tool 2>/dev/null || true

# ── Step 7: Print transcript ──────────────────────────────────────────────────
echo ""
echo "=== Waiting 2s for events to propagate ==="
sleep 2

echo ""
echo "=== /logs transcript (last 50 lines) ==="
tail -50 "$LOG_FILE" | while IFS= read -r line; do
  # Pretty-print each JSON line
  echo "$line" | python3 -m json.tool 2>/dev/null || echo "$line"
done

echo ""
echo "=== Final /runtimes state ==="
curl -s "${OPERATOR_URL}/runtimes" | python3 -m json.tool 2>/dev/null || curl -s "${OPERATOR_URL}/runtimes"

echo ""
echo "=== Fleet smoke complete ==="
