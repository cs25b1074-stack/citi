import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PaymentEvent, StoredTimelineItem, GatewayMetrics } from '../types/pulse';

// ── Sub-Context Interfaces ───────────────────────────────────────────────────

export interface PulseConnectionContextValue {
  isConnected: boolean;
  isReplayMode: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

export interface PulseMetricsContextValue {
  metrics: GatewayMetrics;
}

export interface PulseEventsContextValue {
  timeline: StoredTimelineItem[];
  latestEvent: PaymentEvent | null;
  lastSeq: number;
  selectedScenario: string;
  setSelectedScenario: (id: string) => void;
  simulateCatchup: () => void;
  appendMockEvent: (scenarioId: string, state: PaymentEvent['state']) => void;
}

export interface PulseContextValue
  extends PulseConnectionContextValue,
    PulseMetricsContextValue,
    PulseEventsContextValue {}

// ── Contexts ─────────────────────────────────────────────────────────────────

const PulseConnectionContext = createContext<PulseConnectionContextValue | null>(null);
const PulseMetricsContext = createContext<PulseMetricsContextValue | null>(null);
const PulseEventsContext = createContext<PulseEventsContextValue | null>(null);

// ── Selector Hooks ───────────────────────────────────────────────────────────

export function usePulseConnection(): PulseConnectionContextValue {
  const ctx = useContext(PulseConnectionContext);
  if (!ctx) throw new Error('usePulseConnection must be used within PulseProvider');
  return ctx;
}

export function usePulseMetrics(): PulseMetricsContextValue {
  const ctx = useContext(PulseMetricsContext);
  if (!ctx) throw new Error('usePulseMetrics must be used within PulseProvider');
  return ctx;
}

export function usePulseEvents(): PulseEventsContextValue {
  const ctx = useContext(PulseEventsContext);
  if (!ctx) throw new Error('usePulseEvents must be used within PulseProvider');
  return ctx;
}

/** Unified hook for backward compatibility */
export function usePulse(): PulseContextValue {
  const conn = usePulseConnection();
  const met = usePulseMetrics();
  const ev = usePulseEvents();
  return { ...conn, ...met, ...ev };
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface PulseProviderProps {
  children: React.ReactNode;
  initialScenario?: string;
}

export function PulseProvider({ children, initialScenario = 'happy_path' }: PulseProviderProps) {
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
  const [selectedScenario, _setScenarioState] = useState(initialScenario);
  const [isReplayMode] = useState(() => import.meta.env.VITE_MODE === 'replay');

  // Always holds the current scenario ID — safe to read inside WS callbacks/closures
  const selectedScenarioRef = useRef(initialScenario);
  const setSelectedScenario = useCallback((id: string) => {
    selectedScenarioRef.current = id;
    _setScenarioState(id);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const manualDisconnectRef = useRef(false);
  const pendingUpdatesRef = useRef<StoredTimelineItem[]>([]);
  const batchTimerRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const disconnectedAtRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const isFirstMountRef = useRef(true);
  const connectionInProgressRef = useRef(false);

  // Poll metrics with deep equality check to skip identical renders
  const refreshMetrics = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:4000/metrics');
      if (res.ok) {
        const data: GatewayMetrics = await res.json();
        setMetrics((prev) => {
          if (
            prev.requestsServed === data.requestsServed &&
            prev.eventsPushed === data.eventsPushed &&
            prev.replays === data.replays &&
            prev.escalations === data.escalations
          ) {
            return prev;
          }
          return data;
        });
      }
    } catch {
      // Ignore in standalone/mock mode
    }
  }, []);

  const loadReplayData = useCallback(async (id: string) => {
    try {
      const res = await fetch('/replay/events.json');
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

  // Flush buffered WS events at most every ~200ms; dedupe by txId + state
  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length > 0) {
      const newItems = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      setTimeline((prev) => {
        const existingKeyMap = new Map(
          prev.map((item) => [`${item.event.txId || item.event.id}:${item.event.state}`, item])
        );
        let hasChanges = false;
        for (const item of newItems) {
          const key = `${item.event.txId || item.event.id}:${item.event.state}`;
          if (!existingKeyMap.has(key)) {
            existingKeyMap.set(key, item);
            hasChanges = true;
          }
        }
        if (!hasChanges) return prev;
        return Array.from(existingKeyMap.values()).sort((a, b) => a.seq - b.seq);
      });
    }
    batchTimerRef.current = null;
  }, []);

  // Seed mock transactions on load (for mock/replay mode)
  const seedMockTransactions = useCallback(() => {
    if (!isReplayMode) return;
    const now = new Date().toISOString();
    const mockEvents: StoredTimelineItem[] = [
      {
        seq: 1,
        event: {
          id: 'happy_path',
          state: 'INITIATED',
          heldBy: 'Org1MSP',
          deadlineAt: '',
          txId: 'tx-hp-1',
          at: new Date(Date.now() - 10000).toISOString(),
        },
      },
      {
        seq: 2,
        event: {
          id: 'happy_path',
          state: 'DEBITED',
          heldBy: 'Org2MSP',
          deadlineAt: new Date(Date.now() + 30000).toISOString(),
          txId: 'tx-hp-2',
          at: new Date(Date.now() - 8000).toISOString(),
        },
      },
      {
        seq: 3,
        event: {
          id: 'happy_path',
          state: 'CREDITED',
          heldBy: '',
          deadlineAt: new Date(Date.now() + 30000).toISOString(),
          txId: 'tx-hp-3',
          at: new Date(Date.now() - 5000).toISOString(),
        },
      },
    ];
    setTimeline(mockEvents);
    setLastSeq(3);
    setIsConnected(true);
    setError(null);
  }, [isReplayMode]);

  // Append new event for scenario simulation
  const appendMockEvent = useCallback((scenarioId: string, state: PaymentEvent['state']) => {
    if (!isReplayMode) return;
    setTimeline((prev) => {
      const nextSeq = (prev[prev.length - 1]?.seq ?? 0) + 1;
      const newItem: StoredTimelineItem = {
        seq: nextSeq,
        event: {
          id: scenarioId,
          state,
          heldBy: state === 'INITIATED' || state === 'REVERSED' ? 'Org1MSP' : state === 'DEBITED' || state === 'STUCK' ? 'Org2MSP' : '',
          deadlineAt: state === 'DEBITED' || state === 'STUCK' ? new Date(Date.now() + 30000).toISOString() : '',
          txId: `tx-${scenarioId}-${nextSeq}`,
          at: new Date().toISOString(),
        },
      };
      setLastSeq(nextSeq);
      return [...prev, newItem];
    });
  }, [isReplayMode]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 15000);
    reconnectTimeoutRef.current = window.setTimeout(() => {
      if (mountedRef.current && !manualDisconnectRef.current) {
        reconnectAttemptRef.current++;
        connectWsInternal();
      }
    }, delay);
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptRef.current = 0;
  }, []);

  const updateConnectionStatus = useCallback((connected: boolean) => {
    if (connected) {
      disconnectedAtRef.current = null;
      setIsConnected(true);
    } else {
      disconnectedAtRef.current = Date.now();
      setTimeout(() => {
        if (disconnectedAtRef.current && Date.now() - disconnectedAtRef.current >= 1500) {
          setIsConnected(false);
        }
      }, 1500);
    }
  }, []);

  const connectWsInternal = useCallback(() => {
    if (isReplayMode) {
      seedMockTransactions();
      return;
    }

    manualDisconnectRef.current = false;

    // Prevent multiple simultaneous connection attempts
    if (connectionInProgressRef.current) {
      return;
    }

    // Always read current scenario from ref — safe inside any closure/reconnect
    const scenarioId = selectedScenarioRef.current;

    // If there's already an open connection for this scenario, don't create a new one
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    connectionInProgressRef.current = true;

    const wsUrl = 'ws://localhost:4000/ws';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        connectionInProgressRef.current = false;
        updateConnectionStatus(true);
        setError(null);
        clearReconnect();
        // Read ref again in case scenario changed while connecting
        const subMsg = {
          type: 'subscribe',
          paymentId: selectedScenarioRef.current,
          lastSeq: 0,
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

            pendingUpdatesRef.current.push(newItem);
            setLastSeq((prev) => (prev === msg.seq ? prev : Math.max(prev, msg.seq)));

            // Buffer events with ~200ms batch flush
            if (!batchTimerRef.current) {
              batchTimerRef.current = window.setTimeout(flushPendingUpdates, 200);
            }
          } else if (msg.type === 'error') {
            setError(msg.message || 'Gateway error');
          }
        } catch (e: any) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onclose = () => {
        connectionInProgressRef.current = false;
        updateConnectionStatus(false);
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current);
          batchTimerRef.current = null;
        }
        if (!manualDisconnectRef.current && mountedRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        connectionInProgressRef.current = false;
        updateConnectionStatus(false);
        setError('Cannot connect to ws://localhost:4000/ws');
        loadReplayData(selectedScenarioRef.current);
      };
    } catch (err: any) {
      connectionInProgressRef.current = false;
      console.error('[WS] Connection error:', err);
      setError(err.message);
      updateConnectionStatus(false);
      loadReplayData(scenarioId);
      if (!manualDisconnectRef.current && mountedRef.current) {
        scheduleReconnect();
      }
    }
  }, [
    isReplayMode,
    // selectedScenario intentionally NOT in deps — we use selectedScenarioRef.current
    // to avoid recreating this callback on every scenario change (which breaks reconnect closures)
    seedMockTransactions,
    loadReplayData,
    refreshMetrics,
    flushPendingUpdates,
    updateConnectionStatus,
    clearReconnect,
    scheduleReconnect,
  ]);

  const connectWs = useCallback(() => {
    connectWsInternal();
  }, [connectWsInternal]);

  const disconnectManually = useCallback(() => {
    manualDisconnectRef.current = true;
    clearReconnect();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    updateConnectionStatus(false);
  }, [clearReconnect, updateConnectionStatus]);

  // Single effect to manage WebSocket connection lifecycle:
  // - On mount: establish connection
  // - On scenario change: close old WS, open new one for new scenario
  // - On unmount: cleanup
  useEffect(() => {
    // Skip connectWsInternal on first mount — the mount effect below handles it
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    // Scenario changed — reset state and reconnect
    setTimeline([]);
    setLastSeq(0);
    setError(null);
    clearReconnect();
    pendingUpdatesRef.current = [];

    if (isReplayMode) {
      loadReplayData(selectedScenario);
      return;
    }

    // Close existing WS and open a fresh one for the new scenario.
    // Sending a second 'subscribe' on an open socket would register a second
    // server-side subscriber and cause duplicate/mismatched replay events.
    if (wsRef.current) {
      manualDisconnectRef.current = true; // suppress reconnect from onclose
      wsRef.current.close();
      wsRef.current = null;
      manualDisconnectRef.current = false;
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    connectWsInternal();
  }, [selectedScenario, isReplayMode, loadReplayData, clearReconnect, connectWsInternal]);

  // Mount/unmount effect: establish initial connection and metrics polling
  useEffect(() => {
    // StrictMode double-mount guard: if a connection already exists or is in progress, don't create another
    if (wsRef.current?.readyState === WebSocket.OPEN || connectionInProgressRef.current) {
      mountedRef.current = true;
      return;
    }

    mountedRef.current = true;
    isFirstMountRef.current = false; // mark first mount as done
    connectWsInternal();
    const interval = setInterval(refreshMetrics, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearReconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  const latestEvent = useMemo(
    () => (timeline.length > 0 ? timeline[timeline.length - 1].event : null),
    [timeline]
  );

  const simulateCatchup = useCallback(() => {
    disconnectManually();
    setTimeout(() => {
      connectWsInternal();
    }, 600);
  }, [disconnectManually, connectWsInternal]);

  // Separate memoized sub-contexts to isolate re-render domains
  const connectionValue = useMemo(
    () => ({
      isConnected,
      isReplayMode,
      error,
      connect: connectWs,
      disconnect: disconnectManually,
    }),
    [isConnected, isReplayMode, error, connectWs, disconnectManually]
  );

  const metricsValue = useMemo(
    () => ({
      metrics,
    }),
    [metrics]
  );

  const eventsValue = useMemo(
    () => ({
      timeline,
      latestEvent,
      lastSeq,
      selectedScenario,
      setSelectedScenario,
      simulateCatchup,
      appendMockEvent,
    }),
    [
      timeline,
      latestEvent,
      lastSeq,
      selectedScenario,
      setSelectedScenario,
      simulateCatchup,
      appendMockEvent,
    ]
  );

  return (
    <PulseConnectionContext.Provider value={connectionValue}>
      <PulseMetricsContext.Provider value={metricsValue}>
        <PulseEventsContext.Provider value={eventsValue}>
          {children}
        </PulseEventsContext.Provider>
      </PulseMetricsContext.Provider>
    </PulseConnectionContext.Provider>
  );
}
