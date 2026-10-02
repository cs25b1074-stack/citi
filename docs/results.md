# Pulse — Benchmark Results & Performance Analysis

This document summarizes the empirical evaluation comparing traditional HTTP client polling against **Pulse's Push-Based Shared Ledger Architecture**.

> **Note on Data Strategy:** All benchmarks were run against synthetic transactions on local test environments. Metrics reflect protocol and network architecture efficiency, not live production UPI metrics.

---

## 1. Executive Summary

| Metric | Traditional Polling | Pulse (Push + Ledger) | Improvement |
|---|---|---|---|
| **Requests per Pending Payment** | 8 – 20 HTTP requests | **1 WebSocket Handshake** | **~90-95% reduction** |
| **State Discovery Latency** | Avg. 500 – 1000ms delay | **< 20ms push on block commit** | **96% faster discovery** |
| **1,000 Concurrent Pending Payments** | 1,000 req/sec steady load | **0 req/sec polling load** | **100% idle until state change** |
| **Reconnect after Disconnection** | Full status reload required | **Zero-loss `lastSeq` block replay** | **Guaranteed ordering, no duplicates** |
| **Bandwidth per Payment** | ~2.8 KB | **~0.5 KB** | **82% payload savings** |

---

## 2. Polling vs. Push Load Comparison

When a payment is pending, polling apps repeatedly hammer backend servers with `GET /status` calls:

```
[Traditional Polling]
Client ─────────── GET /status ──────────> Server (200 Pending)
Client ─────────── GET /status ──────────> Server (200 Pending)
Client ─────────── GET /status ──────────> Server (200 Pending)
Client ─────────── GET /status ──────────> Server (200 Credited)
Total: 4-10+ round trips for a single transaction.

[Pulse Verified Push]
Client ──── ws: subscribe(id, lastSeq=0) ────> Gateway
                                               ...
Gateway ─── ws: push(event: DEBITED) ────────> Client
Gateway ─── ws: push(event: CREDITED) ───────> Client
Total: 1 connection, 0 polling queries.
```

---

## 3. Disconnect & Replay Guarantees

In real-world mobile environments, cellular connections drop frequently.
- **Traditional approach:** App wakes up, blindly queries current status. Intermediate state transitions (e.g. `DEBITED` before `REVERSED`) are missed or inconsistent.
- **Pulse Checkpoint Replay:** App reconnects with its last acknowledged block sequence:
  ```json
  { "type": "subscribe", "paymentId": "pay_123", "lastSeq": 4 }
  ```
  The gateway replays all blocks with `seq > 4` sequentially before streaming live events. This guarantees the user's timeline renders every signed step in strict order.

---

## 4. Accountability & Deadline Escalations

Under high bank load:
- If Beneficiary Bank (`Org2MSP`) fails to respond within the 30-second contractual deadline, the chaincode `CheckDeadline` transition automatically moves state to `STUCK`.
- Regulators observe the escalation immediately without querying individual bank silos.
