import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PaymentEvent, StoredTimelineItem, GatewayMetrics } from '../types/pulse';
import { useLocalStorage } from '../hooks/useLocalStorage';

const STORAGE_KEY = 'pulse-history-v1';

interface PersistedState {
  timeline: StoredTimelineItem[];
  metrics: GatewayMetrics;
  lastSeq: number;
  selectedScenario: string;
  stuckPaymentIds: string[];
}

const defaultMetrics: GatewayMetrics = {
  requestsServed: 0,
  eventsPushed: 0,
  replays: 0,
  escalations: 0,
};

const defaultPersistedState: PersistedState = {
  timeline: [],
  metrics: defaultMetrics,
  lastSeq: 0,
  selectedScenario: 'happy_path',
  stuckPaymentIds: [],
};

function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') return defaultPersistedState;
  try {
    const item = window.localStorage.getItem(STORAGE_KEY);
    if (!item) return defaultPersistedState;
    const parsed = JSON.parse(item);
    return {
      timeline: parsed.timeline ?? [],
      metrics: parsed.metrics ?? defaultMetrics,
      lastSeq: parsed.lastSeq ?? 0,
      selectedScenario: parsed.selectedScenario ?? 'happy_path',
      stuckPaymentIds: parsed.stuckPaymentIds ?? [],
    };
  } catch {
    return defaultPersistedState;
  }
}

function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save pulse history:', error);
  }
}

function mergeTimeline(existing: StoredTimelineItem[], incoming: StoredTimelineItem[]): StoredTimelineItem[] {
  const existingKeyMap = new Map(
    existing.map((item) => [`${item.event.txId || item.event.id}:${item.event.state}:${item.seq}`, item])
  );
  let hasChanges = false;
  for (const item of incoming) {
    const key = `${item.event.txId || item.event.id}:${item.event.state}:${item.seq}`;
    if (!existingKeyMap.has(key)) {
      existingKeyMap.set(key, item);
      hasChanges = true;
    }
  }
  if (!hasChanges) return existing;
  return Array.from(existingKeyMap.values()).sort((a, b) => a.seq - b.seq);
}

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
  clearHistory: () => void;
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
  const [persistedState, setPersistedState] = useState<PersistedState>(() => loadPersistedState());
  
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReplayMode] = useState(() => import.meta.env.VITE_MODE === 'replay');

  const {
    timeline,
    metrics,
    lastSeq,
    selectedScenario: persistedScenario,
    stuckPaymentIds,
  } = persistedState;

  const selectedScenarioRef = useRef(persistedScenario);
  const timelineRef = useRef(timeline);
  const metricsRef = useRef(metrics);
  const stuckPaymentIdsRef = useRef(stuckPaymentIds);

  timelineRef.current = timeline;
  metricsRef.current = metrics;
  stuckPaymentIdsRef.current = stuckPaymentIds;

  const setSelectedScenario = useCallback((id: string) => {
    selectedScenarioRef.current = id;
    setPersistedState((prev) => {
      const next = { ...prev, selectedScenario: id };
      savePersistedState(next);
      return next;
    });
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

  const refreshMetrics = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:4000/metrics');
      if (res.ok) {
        const data: GatewayMetrics = await res.json();
        setPersistedState((prev) => {
          const nextMetrics = {
            requestsServed: Math.max(prev.metrics.requestsServed, data.requestsServed),
            eventsPushed: Math.max(prev.metrics.eventsPushed, data.eventsPushed),
            replays: Math.max(prev.metrics.replays, data.replays),
            escalations: Math.max(prev.metrics.escalations, data.escalations),
          };
          const next = { ...prev, metrics: nextMetrics };
          savePersistedState(next);
          return next;
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
      setPersistedState((prev) => {
        const mergedTimeline = mergeTimeline(prev.timeline, events);
        const next = { ...prev, timeline: mergedTimeline };
        if (events.length > 0) {
          next.lastSeq = Math.max(prev.lastSeq, events[events.length - 1].seq);
        }
        savePersistedState(next);
        return next;
      });
      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      setError(`Replay error: ${err.message}`);
    }
  }, []);

  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length > 0) {
      const newItems = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      setPersistedState((prev) => {
        const mergedTimeline = mergeTimeline(prev.timeline, newItems);
        if (mergedTimeline.length <= prev.timeline.length) return prev;
        const next = { ...prev, timeline: mergedTimeline };
        savePersistedState(next);
        return next;
      });
    }
    batchTimerRef.current = null;
  }, []);

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
    setPersistedState((prev) => {
      const mergedTimeline = mergeTimeline(prev.timeline, mockEvents);
      const next = {
        ...prev,
        timeline: mergedTimeline,
        lastSeq: Math.max(prev.lastSeq, 3),
      };
      savePersistedState(next);
      return next;
    });
    setIsConnected(true);
    setError(null);
  }, [isReplayMode]);

  const appendMockEvent = useCallback((scenarioId: string, state: PaymentEvent['state']) => {
    if (!isReplayMode) return;
    setPersistedState((prev) => {
      const nextSeq = (prev.timeline[prev.timeline.length - 1]?.seq ?? 0) + 1;
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
      const mergedTimeline = mergeTimeline(prev.timeline, [newItem]);
      const next = {
        ...prev,
        timeline: mergedTimeline,
        lastSeq: Math.max(prev.lastSeq, nextSeq),
      };
      savePersistedState(next);
      return next;
    });
  }, [isReplayMode]);

  const clearHistory = useCallback(() => {
    const cleared = defaultPersistedState;
    savePersistedState(cleared);
    setPersistedState(cleared);
    setError(null);
  }, []);

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

    if (connectionInProgressRef.current) {
      return;
    }

    const scenarioId = selectedScenarioRef.current;

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
            
            setPersistedState((prev) => {
              const nextLastSeq = Math.max(prev.lastSeq, msg.seq);
              
              let nextMetrics = { ...prev.metrics };
              if (msg.event.state === 'STUCK') {
                if (!prev.stuckPaymentIds.includes(msg.event.id)) {
                  nextMetrics = {
                    ...nextMetrics,
                    escalations: nextMetrics.escalations + 1,
                  };
                  if (!stuckPaymentIdsRef.current.includes(msg.event.id)) {
                    stuckPaymentIdsRef.current = [...stuckPaymentIdsRef.current, msg.event.id];
                  }
                }
              }
              
              nextMetrics = {
                requestsServed: Math.max(nextMetrics.requestsServed, prev.metrics.requestsServed),
                eventsPushed: Math.max(nextMetrics.eventsPushed, prev.metrics.eventsPushed),
                replays: Math.max(nextMetrics.replays, prev.metrics.replays),
                escalations: Math.max(nextMetrics.escalations, prev.metrics.escalations),
              };

              const next = {
                ...prev,
                lastSeq: nextLastSeq,
                metrics: nextMetrics,
                stuckPaymentIds: stuckPaymentIdsRef.current,
              };
              savePersistedState(next);
              return next;
            });
            
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

  // Scenario change: only switch scenario, keep history/counters
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    clearReconnect();
    pendingUpdatesRef.current = [];

    if (isReplayMode) {
      loadReplayData(selectedScenarioRef.current);
      return;
    }

    if (wsRef.current) {
      manualDisconnectRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
      manualDisconnectRef.current = false;
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    connectWsInternal();
  }, [persistedScenario, isReplayMode, loadReplayData, clearReconnect, connectWsInternal]);

  // Mount effect
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || connectionInProgressRef.current) {
      mountedRef.current = true;
      return;
    }

    mountedRef.current = true;
    isFirstMountRef.current = false;
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
      selectedScenario: persistedScenario,
      setSelectedScenario,
      simulateCatchup,
      appendMockEvent,
      clearHistory,
    }),
    [
      timeline,
      latestEvent,
      lastSeq,
      persistedScenario,
      setSelectedScenario,
      simulateCatchup,
      appendMockEvent,
      clearHistory,
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