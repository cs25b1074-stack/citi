#!/usr/bin/env bash
set -euo pipefail
FS="${FABRIC_SAMPLES:-$HOME/fabric/fabric-samples}"
cd "$FS/test-network"
(cd addOrg3 && ./addOrg3.sh down) || true
./network.sh down
