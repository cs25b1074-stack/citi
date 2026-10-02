import { describe, it, expect } from 'vitest';
import { PaymentEvent } from './pulse';

describe('Pulse Event Types & Logic', () => {
  it('validates a happy path payment event structure', () => {
    const event: PaymentEvent = {
      id: 'happy_path',
      state: 'CREDITED',
      heldBy: 'Org2MSP',
      deadlineAt: '2026-10-02T10:00:30.000Z',
      txId: 'tx-123456789',
      at: '2026-10-02T10:00:05.000Z',
    };

    expect(event.state).toBe('CREDITED');
    expect(event.heldBy).toBe('Org2MSP');
    expect(event.txId).toContain('tx-');
  });

  it('correctly identifies stuck escalation state', () => {
    const event: PaymentEvent = {
      id: 'bank_b_silent',
      state: 'STUCK',
      heldBy: 'Org2MSP',
      deadlineAt: '2026-10-02T10:00:30.000Z',
      txId: 'tx-999999',
      at: '2026-10-02T10:00:35.000Z',
    };

    expect(event.state).toBe('STUCK');
    expect(new Date(event.at).getTime()).toBeGreaterThan(new Date(event.deadlineAt).getTime());
  });
});
