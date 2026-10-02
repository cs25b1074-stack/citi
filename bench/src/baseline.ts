/**
 * Polling Baseline Benchmark
 * Simulates traditional mobile banking clients repeatedly polling for payment state.
 */

const GATEWAY_URL = process.env['GATEWAY_URL'] || 'http://localhost:4000';
const PAYMENT_ID = process.env['PAYMENT_ID'] || 'happy_path';
const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 30;

interface BaselineResult {
  strategy: string;
  totalRequests: number;
  finalState: string;
  elapsedMs: number;
  averageIntervalMs: number;
  bytesTransferred: number;
}

export async function runBaseline(paymentId: string = PAYMENT_ID): Promise<BaselineResult> {
  console.log(`[Baseline] Starting polling for payment "${paymentId}" via ${GATEWAY_URL}...`);
  const startTime = Date.now();
  let requests = 0;
  let finalState = 'UNKNOWN';
  let bytes = 0;

  for (let i = 0; i < MAX_POLLS; i++) {
    requests++;
    try {
      const res = await fetch(`${GATEWAY_URL}/baseline/status/${paymentId}`);
      const text = await res.text();
      bytes += text.length;
      if (res.ok) {
        const data = JSON.parse(text);
        finalState = data.state;
        if (['CREDITED', 'REVERSED', 'DECLINED', 'STUCK', 'DISPUTED'].includes(data.state)) {
          console.log(`[Baseline] Reached terminal state "${data.state}" after ${requests} requests.`);
          break;
        }
      }
    } catch (err: any) {
      console.warn(`[Baseline] Request ${requests} failed: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const elapsedMs = Date.now() - startTime;
  const result: BaselineResult = {
    strategy: 'HTTP Polling (1s interval)',
    totalRequests: requests,
    finalState,
    elapsedMs,
    averageIntervalMs: requests > 1 ? Math.round(elapsedMs / requests) : 0,
    bytesTransferred: bytes,
  };

  console.log('[Baseline Results]:', JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1]?.endsWith('baseline.ts')) {
  runBaseline().catch(console.error);
}
