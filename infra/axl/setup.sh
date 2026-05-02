#!/usr/bin/env bash
# infra/axl/setup.sh — one-time setup for the AXL transport demo.
# Generates ed25519 keys for nodes A and B and prints the values you need
# to paste into apps/demo-ui/.env.local.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p keys data
[[ -f bin/axl-node ]] || { echo "missing bin/axl-node — copy from /tmp/axl-spike/node"; exit 1; }

for n in a b; do
  if [[ ! -f "keys/node-$n.pem" ]]; then
    openssl genpkey -algorithm ed25519 -out "keys/node-$n.pem"
    echo "generated keys/node-$n.pem"
  else
    echo "keys/node-$n.pem already exists, skipping"
  fi
done

echo
echo "Now start node A and node B in two separate terminals:"
echo "  pnpm dev:axl-a      # api 9001, tls 9101"
echo "  pnpm dev:axl-b      # api 9002 (this is what demo-ui polls)"
echo
echo "Once both are up, fetch the pubkey of node A:"
echo "  curl -s http://127.0.0.1:9001/topology | grep -oE '\"our_public_key\":\"[^\"]+\"'"
echo
echo "Paste it into apps/demo-ui/.env.local as VITE_AXL_DEST_PEER_ID."
