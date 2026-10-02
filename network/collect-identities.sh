#!/usr/bin/env bash
set -euo pipefail
FS="${FABRIC_SAMPLES:-$HOME/fabric/fabric-samples}"
OUT="$(cd "$(dirname "$0")" && pwd)/out/organizations"
rm -rf "$OUT" && mkdir -p "$OUT"
cp -r "$FS/test-network/organizations/peerOrganizations" "$OUT/"
echo "Identities copied to $OUT"
echo "Org1 peer: localhost:7051  (peer0.org1.example.com)"
echo "Org2 peer: localhost:9051  (peer0.org2.example.com)"
echo "Org3 peer: localhost:11051 (peer0.org3.example.com)"
