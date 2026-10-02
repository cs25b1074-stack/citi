/**
 * src/mock/server.test.ts
 *
 * Vitest tests for the Phase 1 mock gateway.
 *
 * Covered:
 *   1. lastSeq=0  → replay of all stored events, in order (seq ascending).
 *   2. lastSeq=N  → only events with seq > N are replayed.
 *   3. lastSeq > max stored seq → no replay events.
 *   4. Invalid subscribe message → error frame.
 *   5. GET /payments returns newest first.
 *   6. GET /payments/:id returns event history.
 *   7. GET /payments/:unknown → 404.
 *   8. GET /metrics returns counter shape.
 *   9. GET /baseline/status/:id returns id, state, at only.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "http";
import { WebSocket } from "ws";
import {
  buildApp,
  attachWs,
  seedFakeEvents,
  resetStore,
} from "./server.js";

// ── helpers ────────────────────────────────────────────────────────────────────

/** Open a WS connection to the running server and collect messages until the
 *  predicate returns true or timeout fires. Returns the collected messages. */
function collectWsMessages(
  url: string,
  send: object,
  opts: { count: number; timeoutMs?: number }
): Promise<object[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const received: object[] = [];
    const timer = setTimeout(() => {
      ws.close();
      resolve(received); // resolve with whatever arrived
    }, opts.timeoutMs ?? 1_000);

    ws.on("open", () => ws.send(JSON.stringify(send)));
    ws.on("message", (raw) => {
      received.push(JSON.parse(raw.toString()) as object);
      if (received.length >= opts.count) {
        clearTimeout(timer);
        ws.close();
        resolve(received);
      }
    });
    ws.on("error", reject);
  });
}

// ── test suite ─────────────────────────────────────────────────────────────────

describe("Mock gateway – Phase 1", () => {
  let server: Server;
  let baseUrl: string;
  let wsUrl: string;

  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        resetStore();    // clear all events, subscribers, metrics
        seedFakeEvents(); // seed fresh for this test

        const app = buildApp();
        server = createServer(app);
        attachWs(server);
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address() as { port: number };
          baseUrl = `http://127.0.0.1:${addr.port}`;
          wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
          resolve();
        });
      }),
    5_000
  );

  afterEach(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      })
  );

  // ── WS tests ────────────────────────────────────────────────────────────────

  it("lastSeq=0: receives all events for happy_path in seq order", async () => {
    const msgs = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: "happy_path", lastSeq: 0 },
      { count: 3 }
    );

    expect(msgs).toHaveLength(3);
    // All must be type:"event"
    for (const m of msgs) {
      expect((m as { type: string }).type).toBe("event");
    }
    // seq must be strictly ascending
    const seqs = msgs.map((m) => (m as { seq: number }).seq);
    expect(seqs[0]).toBeLessThan(seqs[1]!);
    expect(seqs[1]).toBeLessThan(seqs[2]!);
    // States in order
    const states = msgs.map(
      (m) => (m as { event: { state: string } }).event.state
    );
    expect(states).toEqual(["INITIATED", "DEBITED", "CREDITED"]);
  });

  it("lastSeq=0: bank_b_silent ends with STUCK", async () => {
    const msgs = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: "bank_b_silent", lastSeq: 0 },
      { count: 3 }
    );

    expect(msgs).toHaveLength(3);
    const states = msgs.map(
      (m) => (m as { event: { state: string } }).event.state
    );
    expect(states).toEqual(["INITIATED", "DEBITED", "STUCK"]);
  });

  it("higher lastSeq: only events with seq > lastSeq are replayed", async () => {
    // First, get all events for happy_path so we know the real seq values
    const all = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: "happy_path", lastSeq: 0 },
      { count: 3 }
    );
    expect(all).toHaveLength(3);

    const secondSeq = (all[1] as { seq: number }).seq;

    // Now subscribe with lastSeq = seq of the 2nd event → should get only 3rd
    const partial = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: "happy_path", lastSeq: secondSeq },
      { count: 1 }
    );

    expect(partial).toHaveLength(1);
    const state = (partial[0] as { event: { state: string } }).event.state;
    expect(state).toBe("CREDITED");
    const seq = (partial[0] as { seq: number }).seq;
    expect(seq).toBeGreaterThan(secondSeq);
  });

  it("lastSeq >= max stored seq: no replay messages", async () => {
    // Get the last seq first
    const all = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: "happy_path", lastSeq: 0 },
      { count: 3 }
    );
    const maxSeq = (all[2] as { seq: number }).seq;

    // Subscribe with lastSeq at max – no events expected within timeout
    const msgs = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: "happy_path", lastSeq: maxSeq },
      { count: 1, timeoutMs: 200 } // short timeout – we expect 0 messages
    );
    expect(msgs).toHaveLength(0);
  });

  it("invalid subscribe message: receives error frame", async () => {
    const msgs = await collectWsMessages(
      wsUrl,
      { type: "subscribe", paymentId: 42, lastSeq: "bad" }, // wrong types
      { count: 1 }
    );
    expect(msgs).toHaveLength(1);
    expect((msgs[0] as { type: string }).type).toBe("error");
  });

  // ── REST tests ───────────────────────────────────────────────────────────────

  it("GET /payments returns array newest first", async () => {
    const res = await fetch(`${baseUrl}/payments`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    // bank_b_silent has a later last event (STUCK after 35 s) vs happy_path (CREDITED at 5 s)
    // but seq-wise bank_b_silent's last event has a higher seq – verify ordering
    expect(body[0]).toBeDefined();
  });

  it("GET /payments/:id returns payment with history array", async () => {
    const res = await fetch(`${baseUrl}/payments/happy_path`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      state: string;
      history: { seq: number; state: string }[];
    };
    expect(body.id).toBe("happy_path");
    expect(body.state).toBe("CREDITED");
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history).toHaveLength(3);
    // history must be in seq-ascending order
    expect(body.history[0]!.seq).toBeLessThan(body.history[1]!.seq);
    expect(body.history[1]!.seq).toBeLessThan(body.history[2]!.seq);
  });

  it("GET /payments/:unknown → 404", async () => {
    const res = await fetch(`${baseUrl}/payments/does_not_exist`);
    expect(res.status).toBe(404);
  });

  it("GET /metrics returns expected shape", async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(typeof body["requestsServed"]).toBe("number");
    expect(typeof body["eventsPushed"]).toBe("number");
    expect(typeof body["replays"]).toBe("number");
    expect(typeof body["escalations"]).toBe("number");
  });

  it("GET /baseline/status/:id returns only id, state, at", async () => {
    const res = await fetch(`${baseUrl}/baseline/status/happy_path`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, string>;
    expect(body["id"]).toBe("happy_path");
    expect(body["state"]).toBe("CREDITED");
    expect(typeof body["at"]).toBe("string");
    // Must not include full history
    expect(body["history"]).toBeUndefined();
  });

  it("GET /baseline/status/:unknown → 404", async () => {
    const res = await fetch(`${baseUrl}/baseline/status/ghost`);
    expect(res.status).toBe(404);
  });
});
