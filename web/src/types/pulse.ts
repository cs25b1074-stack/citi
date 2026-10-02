export type PaymentState =
  | 'INITIATED'
  | 'DEBITED'
  | 'CREDITED'
  | 'REVERSED'
  | 'DECLINED'
  | 'STUCK'
  | 'DISPUTED';

export interface PaymentEvent {
  id: string;
  state: PaymentState;
  heldBy: string;
  deadlineAt: string;
  txId: string;
  at: string;
}

export interface StoredTimelineItem {
  seq: number;
  event: PaymentEvent;
}

export interface GatewayMetrics {
  requestsServed: number;
  eventsPushed: number;
  replays: number;
  escalations: number;
}

export interface WsMessage {
  type: 'event' | 'error';
  seq?: number;
  event?: PaymentEvent;
  message?: string;
}
