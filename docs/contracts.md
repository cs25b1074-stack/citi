# Pulse — Shared Contracts (Frozen)

This document contains the frozen interfaces between the Ledger (Dharmik), Gateway/Simulators (Ritu), and Frontend/Benchmarks (Mithunn).

---

## 1. Chaincode Functions (Dharmik)

- `CreatePayment(id, remitterOrg, beneficiaryOrg, deadlineSeconds)`
- `ReportDebited(id)`
- `ReportCredited(id)`
- `ReportReversed(id)`
- `ReportDeclined(id)`
- `CheckDeadline(id)`
- `GetPayment(id)`

---

## 2. Organization Mapping

| Org | MSP ID | Role |
|---|---|---|
| Org1 | `Org1MSP` | Remitter bank (Bank A) |
| Org2 | `Org2MSP` | Beneficiary bank (Bank B) |
| Org3 | `Org3MSP` | Regulator / Auditor (read-only) |

---

## 3. Event Payload (`PaymentStateChanged`)

Emitted by chaincode on every state transition.

```json
{
  "id": "hash-or-payment-id",
  "state": "DEBITED",
  "heldBy": "Org2MSP",
  "deadlineAt": "2026-10-04T10:15:30Z",
  "txId": "abc12345...",
  "at": "2026-10-04T10:15:00Z"
}
```

Allowed States:
`INITIATED`, `DEBITED`, `CREDITED`, `REVERSED`, `DECLINED`, `STUCK`, `DISPUTED`

---

## 4. Gateway WebSocket Contract

- **Endpoint:** `ws://localhost:4000/ws`
- **Client to Server (Subscribe / Replay Checkpoint):**
  ```json
  {
    "type": "subscribe",
    "paymentId": "happy_path",
    "lastSeq": 0
  }
  ```
- **Server to Client (Event Stream):**
  ```json
  {
    "type": "event",
    "seq": 1,
    "event": {
      "id": "happy_path",
      "state": "INITIATED",
      "heldBy": "Org1MSP",
      "deadlineAt": "",
      "txId": "tx-1",
      "at": "2026-10-02T10:00:00.000Z"
    }
  }
  ```
- **Replay Behavior:** On subscribe, server immediately replays events where `seq > lastSeq`, then keeps connection open for live events.

---

## 5. Gateway REST Contract

- `GET /payments` — Returns array of latest payment states sorted newest first.
- `GET /payments/:id` — Returns single payment with `{ ...latest, history: [...] }`.
- `GET /metrics` — Returns `{ requestsServed, eventsPushed, replays, escalations }`.
- `GET /baseline/status/:id` — Standard polling endpoint for baseline comparison.

---

## 6. Simulator Control API

- **Endpoint:** `POST http://localhost:4100/scenario`
- **Request Body:**
  ```json
  {
    "type": "happy | bank_b_silent | duplicate_credit | late_credit_after_reversal | bank_b_slow",
    "count": 1,
    "deadlineSeconds": 30
  }
  ```

---

## 7. Ports

- **Gateway:** `4000`
- **Simulators:** `4100`
- **Web App:** `5173`
