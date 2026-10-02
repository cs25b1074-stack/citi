# Ledger layer: chaincode, network and endorsement

Owner: Dharmik. Covers `chaincode/` and `network/`.

## Network

- Hyperledger Fabric 2.5.9, based on `fabric-samples/test-network`, run locally in Docker.
- Channel: `pulsechannel`. Three orgs: Org1 (remitter bank), Org2 (beneficiary bank), Org3 (regulator).
- Org3 is a channel member for reading only. It does not approve or run the chaincode.
- Chaincode name: `pulse`. Default endorsement policy: `OR('Org1MSP.peer','Org2MSP.peer')`.
- Bring-up: `network/up.sh`. Teardown: `network/down.sh`. Gateway identities: `network/collect-identities.sh`, which copies certs and keys to `network/out/organizations/` (gitignored, never commit).

| Org | Peer address | TLS host alias |
|---|---|---|
| Org1 | localhost:7051 | peer0.org1.example.com |
| Org2 | localhost:9051 | peer0.org2.example.com |
| Org3 | localhost:11051 | peer0.org3.example.com |

### Deployment note: chaincode as a service (CCaaS)

The standard `deployCC` failed on this setup. The peer's own Docker image build failed with a broken pipe on `docker.sock` under Docker 29.8.1. We switched to `./network.sh deployCCAAS`, where the chaincode runs as its own container (see `chaincode/Dockerfile`, port 9999) and the peer connects to it. The state machine is unchanged by this. `main.go` starts a chaincode server instead of the normal shim. Re-deploying after a code change needs a higher version and sequence (`-ccv`, `-ccs`) and the old `peer0orgN_pulse_ccaas` containers removed first.

## State machine

States: `INITIATED, DEBITED, CREDITED, REVERSED, DECLINED, STUCK, DISPUTED`.

| From | Function | To | Caller must be | Held by after |
|---|---|---|---|---|
| (new) | `CreatePayment` | INITIATED | Remitter org | Remitter |
| INITIATED | `ReportDebited` | DEBITED | Remitter org | Beneficiary |
| INITIATED | `ReportDeclined` | DECLINED | Remitter org | nobody |
| DEBITED | `ReportCredited` | CREDITED | Beneficiary org | nobody |
| DEBITED | `ReportReversed` | REVERSED | Remitter org | nobody |
| DEBITED | `CheckDeadline` (deadline passed) | STUCK | Any org | Beneficiary |
| STUCK | `ReportCredited` | CREDITED | Beneficiary org | nobody |
| STUCK | `ReportReversed` | REVERSED | Remitter org | nobody |
| REVERSED | `ReportCredited` (late) | DISPUTED | Beneficiary org | nobody |

Any other transition returns an error. Org3 (regulator) cannot write payment steps.

## Rules enforced in the chaincode

- The caller's MSP ID is read from the client identity. A wrong org gets an error such as `caller Org2MSP not allowed, Org1MSP required`.
- `CreatePayment` rejects an empty id, identical remitter and beneficiary, a non-positive deadline, and a duplicate id.
- Deadlines use the transaction timestamp (`GetTxTimestamp`), never `time.Now()`, so all peers agree. `deadlineAt` is the debit time plus `deadlineSeconds`.
- `CheckDeadline` only applies to DEBITED payments and fails if the deadline has not passed.
- Every successful state change emits the event `PaymentStateChanged` with `id, state, heldBy, deadlineAt, txId, at`. A failed call emits nothing.

## State-based endorsement

When a payment reaches `CREDITED`, `DISPUTED` (beneficiary signed the step) or `DECLINED` (remitter signed the step), the chaincode sets a key-level endorsement policy on that payment. Any later write to that key then needs an endorsement from a peer of the owning org, as a second lock beneath the in-chaincode checks.

`REVERSED` is deliberately not locked, because the beneficiary can still move it to `DISPUTED` with a late credit.

Status: covered by unit tests. Live behaviour on the network: [X confirm after testing, or say "not yet tested live"].

## Privacy

All payment data (ids, orgs, states, deadlines) is on the channel and visible to all three orgs, by design: the regulator needs to see it. All data is synthetic. Private data collections for amounts are a COULD item and are not implemented.

## Tests

`cd chaincode && go test ./...` runs table-driven tests (in-memory fakes, no network needed) for every valid transition, wrong-org calls for each function, invalid transitions, deadline timing, event emission and the endorsement lock.

## Drunix

[X Not yet attempted. Fill in each difference from plain Fabric once the port is tried. Do not claim Drunix behaviour that was not tested.]

## Known limitations

- Local single-machine network, simulated banks, synthetic data.
- Chaincode runs as a service because of the Docker 29 build issue above.
- No real UPI behaviour is claimed.
