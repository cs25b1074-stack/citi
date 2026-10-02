#!/usr/bin/env bash
set -euo pipefail
FS="${FABRIC_SAMPLES:-$HOME/fabric/fabric-samples}"
HERE="$(cd "$(dirname "$0")" && pwd)"
CC_PATH="$(cd "$HERE/../chaincode" && pwd)"

cd "$FS/test-network"
./network.sh down || true
./network.sh up createChannel -c pulsechannel -ca
(cd addOrg3 && ./addOrg3.sh up -c pulsechannel -ca)
./network.sh deployCCAAS -c pulsechannel -ccn pulse -ccp "$CC_PATH" \
  -ccep "OR('Org1MSP.peer','Org2MSP.peer')"
"$HERE/collect-identities.sh"
echo "Pulse network is up."
