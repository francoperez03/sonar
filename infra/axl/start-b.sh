#!/usr/bin/env bash
# Start AXL Node B — peer of A; demo-ui polls this one's /recv.
# api 9002, dials A on tls://127.0.0.1:9101.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # repo root
exec ./infra/axl/bin/axl-node -config infra/axl/node-b.json
