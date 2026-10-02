/**
 * Pulse Push Benchmark
 * Measures verified push delivery over WebSocket with checkpoint replay.
 */

import { WebSocket } from 'ws';

const WS_URL = process.env['WS_URL'] || 'ws://localhost:4000/ws';
const PAYMENT_ID = process.env['PAYMENT_ID'] || 'happy_path';

interface PulseResult {
  strategy: string;
  totalConnections: number;
  totalPollingRequests: number;
  eventsReceived: number;
  finalState: string;
  replayedEvents: number;
  elapsedMs: number;
  bytesTransferred: number;
}

export async function runPulse(paymentId: string = PAYMENT_ID, lastSeq: number = 0): Promise<PulseResult> {
  console.log(`[Pulse] Connecting to ${WS_URL} for payment "${paymentId}" with lastSeq=${lastSeq}...`);
  const startTime = Date.now();
  let eventsReceived = 0;
  let replayedEvents = 0;
  let bytes = 0;
  let finalState = 'UNKNOWN';

  return new Promise<PulseResult>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      ws.close();
      resolve({
        strategy: 'Pulse Push (WebSocket + Ledger Checkpoint)',
        totalConnections: 1,
        totalPollingRequests: 0,
        eventsReceived,
        finalState,
        replayedEvents,
        elapsedMs: Date.now() - startTime,
        bytesTransferred: bytes,
      });
    }, 5000);

    ws.on('open', () => {
      const subMsg = JSON.stringify({
        type: 'subscribe',
        paymentId,
        lastSeq,
      });
      bytes += subMsg.length;
      ws.send(subMsg);
    });

    ws.on('message', (data) => {
      const str = data.toString();
      bytes += str.length;
      try {
        const msg = JSON.parse(str);
        if (msg.type === 'event') {
          eventsReceived++;
          if (msg.seq > lastSeq) {
            replayedEvents++;
          }
          finalState = msg.event.state;
          console.log(`[Pulse] Received event seq=${msg.seq} state=${msg.event.state} heldBy=${msg.event.heldBy}`);

          if (['CREDITED', 'REVERSED', 'DECLINED', 'STUCK', 'DISPUTED'].includes(msg.event.state)) {
            clearTimeout(timeout);
            setTimeout(() => {
              ws.close();
              resolve({
                strategy: 'Pulse Push (WebSocket + Ledger Checkpoint)',
                totalConnections: 1,
                totalPollingRequests: 0,
                eventsReceived,
                finalState,
                replayedEvents,
                elapsedMs: Date.now() - startTime,
                bytesTransferred: bytes,
              });
            }, 200);
          }
        }
      } catch (e: any) {
        console.error('[Pulse] Error parsing message:', e.message);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

if (process.argv[1]?.endsWith('pulse.ts')) {
  runPulse().then((res) => console.log('[Pulse Results]:', JSON.stringify(res, null, 2))).catch(console.error);
}
