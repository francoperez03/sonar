#!/usr/bin/env bash
# Start AXL Node A — listening peer.
# api 9001, tls listen 9101, tcp 7000.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # repo root
exec ./infra/axl/bin/axl-node -config infra/axl/node-a.json
