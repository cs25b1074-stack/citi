/**
 * src/mock/server.ts
 *
 * Phase 1 mock gateway. Runs on PORT (default 4000).
 * Emits three fake payment scenarios:
 *   happy_path:        INITIATED -> DEBITED -> CREDITED
 *   bank_b_silent:     INITIATED -> DEBITED -> STUCK (after deadline)
 *   disputed_case:     INITIATED -> DEBITED -> REVERSED -> DISPUTED
 *                      (late credit arrives after Bank A already reversed)
 *
 * REST:  GET /payments, GET /payments/:id, GET /metrics,
 *        GET /baseline/status/:id
 * WS:    ws://localhost:4000/ws
 *   client -> { type:"subscribe", paymentId, lastSeq }
 *   server -> { type:"event", seq, event }
 *   On subscribe: replay events with seq > lastSeq, then stream live.
 */

import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { z } from "zod";

// ── Zod schemas ────────────────────────────────────────────────────────────────

export const PaymentEventSchema = z.object({
  id: z.string(),
  state: z.enum([
    "INITIATED",
    "DEBITED",
    "CREDITED",
    "REVERSED",
    "DECLINED",
    "STUCK",
    "DISPUTED",
  ]),
  heldBy: z.string(),
  deadlineAt: z.string(), // ISO-8601
  txId: z.string(),
  at: z.string(), // ISO-8601
});

export type PaymentEvent = z.infer<typeof PaymentEventSchema>;

export const SubscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  paymentId: z.string(),
  lastSeq: z.number().int().min(0),
});

// ── In-memory store ────────────────────────────────────────────────────────────

export interface StoredEvent {
  seq: number; // maps to block number
  event: PaymentEvent;
}

/** All events, keyed by paymentId. seq is monotonically increasing. */
const eventStore = new Map<string, StoredEvent[]>();

/** Latest state per payment (derived from eventStore). */
const paymentLatest = new Map<string, PaymentEvent>();

/** Subscribers: paymentId → set of live WebSocket clients. */
const subscribers = new Map<string, Set<WebSocket>>();

/** Metrics */
const metrics = {
  requestsServed: 0,
  eventsPushed: 0,
  replays: 0,
  escalations: 0,
};

/** Monotonically increasing sequence counter (maps to block numbers in the real impl). */
let seqCounter = 0;

/** Reset all in-memory state (used by tests for isolation). */
export function resetStore(): void {
  seqCounter = 0;
  eventStore.clear();
  paymentLatest.clear();
  subscribers.clear();
  metrics.requestsServed = 0;
  metrics.eventsPushed = 0;
  metrics.replays = 0;
  metrics.escalations = 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nextSeq(): number {
  return ++seqCounter;
}

function storeEvent(event: PaymentEvent): StoredEvent {
  const seq = nextSeq();
  const stored: StoredEvent = { seq, event };

  if (!eventStore.has(event.id)) {
    eventStore.set(event.id, []);
  }
  eventStore.get(event.id)!.push(stored);
  paymentLatest.set(event.id, event);

  return stored;
}

function broadcast(paymentId: string, stored: StoredEvent): void {
  const subs = subscribers.get(paymentId);
  if (!subs) return;
  const msg = JSON.stringify({ type: "event", seq: stored.seq, event: stored.event });
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      metrics.eventsPushed++;
    }
  }
}

function addSubscriber(paymentId: string, ws: WebSocket): void {
  if (!subscribers.has(paymentId)) {
    subscribers.set(paymentId, new Set());
  }
  subscribers.get(paymentId)!.add(ws);
}

function removeSubscriber(ws: WebSocket): void {
  for (const [, subs] of subscribers) {
    subs.delete(ws);
  }
}

// ── Seed fake data ─────────────────────────────────────────────────────────────

export function seedFakeEvents(): void {
  const now = new Date("2026-10-02T10:00:00.000Z");
  const dl = new Date(now.getTime() + 30_000).toISOString(); // 30-second deadline

  // --- happy_path: INITIATED -> DEBITED -> CREDITED ---
  const hp: PaymentEvent[] = [
    {
      id: "happy_path",
      state: "INITIATED",
      heldBy: "Org1MSP",
      deadlineAt: "",
      txId: "tx-hp-1",
      at: now.toISOString(),
    },
    {
      id: "happy_path",
      state: "DEBITED",
      heldBy: "Org2MSP",
      deadlineAt: dl,
      txId: "tx-hp-2",
      at: new Date(now.getTime() + 2_000).toISOString(),
    },
    {
      id: "happy_path",
      state: "CREDITED",
      heldBy: "",
      deadlineAt: dl,
      txId: "tx-hp-3",
      at: new Date(now.getTime() + 5_000).toISOString(),
    },
  ];

  // --- bank_b_silent: INITIATED -> DEBITED -> STUCK ---
  const bs: PaymentEvent[] = [
    {
      id: "bank_b_silent",
      state: "INITIATED",
      heldBy: "Org1MSP",
      deadlineAt: "",
      txId: "tx-bs-1",
      at: now.toISOString(),
    },
    {
      id: "bank_b_silent",
      state: "DEBITED",
      heldBy: "Org2MSP",
      deadlineAt: dl,
      txId: "tx-bs-2",
      at: new Date(now.getTime() + 2_000).toISOString(),
    },
    {
      id: "bank_b_silent",
      state: "STUCK",
      heldBy: "Org2MSP",
      deadlineAt: dl,
      txId: "tx-bs-3",
      at: new Date(now.getTime() + 35_000).toISOString(),
    },
  ];

  // --- disputed_case: INITIATED -> DEBITED -> REVERSED -> DISPUTED ---
  // Scenario: Bank A reverses after SLA breach; Bank B credits late -> conflict
  const dc: PaymentEvent[] = [
    {
      id: "disputed_case",
      state: "INITIATED",
      heldBy: "Org1MSP",
      deadlineAt: "",
      txId: "tx-dc-1",
      at: now.toISOString(),
    },
    {
      id: "disputed_case",
      state: "DEBITED",
      heldBy: "Org2MSP",
      deadlineAt: dl,
      txId: "tx-dc-2",
      at: new Date(now.getTime() + 2_000).toISOString(),
    },
    {
      id: "disputed_case",
      state: "REVERSED",
      heldBy: "Org1MSP",
      deadlineAt: dl,
      txId: "tx-dc-3",
      at: new Date(now.getTime() + 35_000).toISOString(),
    },
    {
      id: "disputed_case",
      state: "DISPUTED",
      heldBy: "DISPUTED",
      deadlineAt: dl,
      txId: "tx-dc-4",
      at: new Date(now.getTime() + 37_000).toISOString(),
    },
  ];

  for (const ev of [...hp, ...bs, ...dc]) {
    // Validate before storing
    const parsed = PaymentEventSchema.parse(ev);
    storeEvent(parsed);
  }
}

// ── REST ───────────────────────────────────────────────────────────────────────

export function buildApp(): express.Express {
  const app = express();
  app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
  app.use(express.json());

  // Metrics middleware
  app.use((_req, _res, next) => {
    metrics.requestsServed++;
    next();
  });

  // GET /payments — newest-first (by latest event's seq)
  app.get("/payments", (_req, res) => {
    const all = Array.from(paymentLatest.values());
    // Sort by the seq of the last stored event, descending
    all.sort((a, b) => {
      const seqA = eventStore.get(a.id)?.at(-1)?.seq ?? 0;
      const seqB = eventStore.get(b.id)?.at(-1)?.seq ?? 0;
      return seqB - seqA;
    });
    res.json(all);
  });

  // GET /payments/:id — with full event history
  app.get("/payments/:id", (req, res) => {
    const { id } = req.params;
    const latest = paymentLatest.get(id);
    if (!latest) {
      res.status(404).json({ error: "payment not found" });
      return;
    }
    const history = (eventStore.get(id) ?? []).map((s) => ({
      seq: s.seq,
      ...s.event,
    }));
    res.json({ ...latest, history });
  });

  // GET /metrics
  app.get("/metrics", (_req, res) => {
    res.json({ ...metrics });
  });

  // GET /baseline/status/:id — counted separately (increments requestsServed
  // via middleware, but does NOT increment eventsPushed / replays)
  app.get("/baseline/status/:id", (req, res) => {
    const { id } = req.params;
    const latest = paymentLatest.get(id);
    if (!latest) {
      res.status(404).json({ error: "payment not found" });
      return;
    }
    res.json({ id: latest.id, state: latest.state, at: latest.at });
  });

  return app;
}

// ── WebSocket ──────────────────────────────────────────────────────────────────

export function attachWs(server: ReturnType<typeof createServer>): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
        return;
      }

      const result = SubscribeMessageSchema.safeParse(parsed);
      if (!result.success) {
        ws.send(JSON.stringify({ type: "error", message: result.error.message }));
        return;
      }

      const { paymentId, lastSeq } = result.data;

      // Replay stored events with seq > lastSeq
      const stored = eventStore.get(paymentId) ?? [];
      const toReplay = stored.filter((s) => s.seq > lastSeq);
      for (const s of toReplay) {
        ws.send(JSON.stringify({ type: "event", seq: s.seq, event: s.event }));
        metrics.replays++;
        metrics.eventsPushed++;
      }

      // Register for live events
      addSubscriber(paymentId, ws);
    });

    ws.on("close", () => {
      removeSubscriber(ws);
    });
  });

  return wss;
}

// ── Entry point ────────────────────────────────────────────────────────────────

if (process.env["VITEST"] === undefined) {
  seedFakeEvents();

  const PORT = Number(process.env["PORT"] ?? 4000);
  const app = buildApp();
  const server = createServer(app);
  attachWs(server);

  server.listen(PORT, () => {
    console.log(`[mock] Pulse mock gateway listening on http://localhost:${PORT}`);
    console.log(`[mock] WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`[mock] Payments seeded: happy_path, bank_b_silent, disputed_case`);
  });
}
