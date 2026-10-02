import { useState, useEffect, useRef, useCallback } from 'react';
import { PaymentEvent, StoredTimelineItem, GatewayMetrics } from '../types/pulse';

interface UsePulseStreamOptions {
  paymentId: string;
  isReplayMode?: boolean;
}

export function usePulseStream({ paymentId, isReplayMode = false }: UsePulseStreamOptions) {
  const [timeline, setTimeline] = useState<StoredTimelineItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSeq, setLastSeq] = useState(0);
  const [metrics, setMetrics] = useState<GatewayMetrics>({
    requestsServed: 0,
    eventsPushed: 0,
    replays: 0,
    escalations: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const manualDisconnectRef = useRef(false);

  // Fetch metrics from REST
  const refreshMetrics = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:4000/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // Ignore in standalone/replay mode
    }
  }, []);

  // Handle Replay Mode from static JSON
  const loadReplayData = useCallback(async (id: string) => {
    try {
      const res = await fetch('./replay/events.json');
      if (!res.ok) throw new Error('Could not load replay JSON');
      const data = await res.json();
      const events: StoredTimelineItem[] = data[id] || data['happy_path'] || [];
      setTimeline(events);
      if (events.length > 0) {
        setLastSeq(events[events.length - 1].seq);
      }
      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      setError(`Replay error: ${err.message}`);
    }
  }, []);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (isReplayMode) {
      loadReplayData(paymentId);
      return;
    }

    manualDisconnectRef.current = false;
    const wsUrl = 'ws://localhost:4000/ws';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        // Send subscribe message with current lastSeq checkpoint
        const subMsg = {
          type: 'subscribe',
          paymentId,
          lastSeq,
        };
        ws.send(JSON.stringify(subMsg));
        refreshMetrics();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'event' && msg.event) {
            const newItem: StoredTimelineItem = {
              seq: msg.seq,
              event: msg.event as PaymentEvent,
            };

            setTimeline((prev) => {
              // Avoid duplicates by seq or state
              const exists = prev.some((item) => item.seq === newItem.seq);
              if (exists) return prev;
              const updated = [...prev, newItem].sort((a, b) => a.seq - b.seq);
              return updated;
            });

            setLastSeq((prev) => Math.max(prev, msg.seq));
            refreshMetrics();
          } else if (msg.type === 'error') {
            setError(msg.message || 'Gateway error');
          }
        } catch (e: any) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!manualDisconnectRef.current) {
          // If not manually disconnected, attempt to fall back to replay if gateway down
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setError('Cannot connect to ws://localhost:4000/ws. Fallback to replay mode available.');
        // Auto fallback to local mock data if gateway isn't started yet
        loadReplayData(paymentId);
      };
    } catch (err: any) {
      setError(err.message);
      loadReplayData(paymentId);
    }
  }, [paymentId, lastSeq, isReplayMode, loadReplayData, refreshMetrics]);

  // Disconnect function for testing catchup
  const disconnectManually = useCallback(() => {
    manualDisconnectRef.current = true;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Reset timeline when paymentId changes
  useEffect(() => {
    setTimeline([]);
    setLastSeq(0);
  }, [paymentId]);

  // Connect on mount / paymentId change
  useEffect(() => {
    connectWs();
    const interval = setInterval(refreshMetrics, 3000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs, refreshMetrics]);

  const latestEvent = timeline.length > 0 ? timeline[timeline.length - 1].event : null;

  return {
    timeline,
    latestEvent,
    isConnected,
    lastSeq,
    metrics,
    error,
    connect: connectWs,
    disconnect: disconnectManually,
    refreshMetrics,
  };
}
