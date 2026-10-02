import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Hash,
  Building2,
  Cpu,
  RefreshCw,
  Info
} from 'lucide-react';
import { PaymentEvent, StoredTimelineItem } from '../types/pulse';

interface PaymentTimelineProps {
  timeline: StoredTimelineItem[];
  latestEvent: PaymentEvent | null;
  lastSeq: number;
  isConnected: boolean;
  onSimulateCatchup: () => void;
}

export const PaymentTimeline: React.FC<PaymentTimelineProps> = ({
  timeline,
  latestEvent,
  lastSeq,
  isConnected,
  onSimulateCatchup,
}) => {
  // Live deadline countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!latestEvent || !latestEvent.deadlineAt || latestEvent.state !== 'DEBITED') {
      setSecondsRemaining(null);
      return;
    }

    const target = new Date(latestEvent.deadlineAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setSecondsRemaining(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [latestEvent]);

  // Determine custody message
  const getCustodyBanner = () => {
    if (!latestEvent) {
      return {
        title: 'Awaiting Payment Activity',
        subtitle: 'No transactions registered on channel yet.',
        bg: 'border-slate-800 bg-slate-900/60',
        textColor: 'text-slate-400',
        icon: <Clock className="w-6 h-6 text-slate-400" />,
      };
    }

    switch (latestEvent.state) {
      case 'INITIATED':
        return {
          title: 'Money is with: Remitter Bank (Org1MSP)',
          subtitle: 'Payment instruction validated. Awaiting debit confirmation.',
          bg: 'border-cyan-500/30 bg-cyan-950/40 glow-cyan',
          textColor: 'text-cyan-300',
          icon: <Building2 className="w-6 h-6 text-cyan-400" />,
        };
      case 'DEBITED':
        return {
          title: 'Money is with: Beneficiary Bank (Org2MSP)',
          subtitle: 'Bank A debited. Bank B holds custody under contract deadline.',
          bg: 'border-amber-500/40 bg-amber-950/40 glow-amber',
          textColor: 'text-amber-300',
          icon: <Building2 className="w-6 h-6 text-amber-400 animate-pulse" />,
        };
      case 'CREDITED':
        return {
          title: 'Settled: Recipient Credited',
          subtitle: 'Org2MSP signed credit confirmation. Transaction final on ledger.',
          bg: 'border-emerald-500/40 bg-emerald-950/40 glow-emerald',
          textColor: 'text-emerald-300',
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
        };
      case 'STUCK':
        return {
          title: 'ESCALATED: Payment Stuck with Org2MSP',
          subtitle: 'Org2MSP exceeded 30s SLA deadline. Flagged on regulator ledger.',
          bg: 'border-rose-500/50 bg-rose-950/50 glow-rose',
          textColor: 'text-rose-300',
          icon: <AlertTriangle className="w-6 h-6 text-rose-400 animate-bounce" />,
        };
      case 'DISPUTED':
        return {
          title: 'DISPUTED: Conflicting Org Signatures',
          subtitle: 'Beneficiary credited after remitter reversal. Escalated for arbitration.',
          bg: 'border-purple-500/40 bg-purple-950/40',
          textColor: 'text-purple-300',
          icon: <AlertTriangle className="w-6 h-6 text-purple-400" />,
        };
      case 'REVERSED':
        return {
          title: 'Money Returned: Remitter Account Credited',
          subtitle: 'Debit was reversed back to sender account by Org1MSP.',
          bg: 'border-slate-700 bg-slate-900/60',
          textColor: 'text-slate-300',
          icon: <RefreshCw className="w-6 h-6 text-slate-400" />,
        };
      case 'DECLINED':
        return {
          title: 'Declined by Remitter Bank',
          subtitle: 'Insufficient funds or policy restriction by Org1MSP.',
          bg: 'border-rose-800 bg-rose-950/30',
          textColor: 'text-rose-400',
          icon: <AlertTriangle className="w-6 h-6 text-rose-500" />,
        };
      default:
        return {
          title: `Status: ${latestEvent.state}`,
          subtitle: 'State updated on shared ledger.',
          bg: 'border-slate-800 bg-slate-900',
          textColor: 'text-slate-300',
          icon: <Info className="w-6 h-6 text-slate-400" />,
        };
    }
  };

  const custody = getCustodyBanner();

  return (
    <div className="space-y-6">
      {/* Prominent Custody & Accountability Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${custody.bg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 shrink-0">
              {custody.icon}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
                  Current Custody & Responsibility
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <h2 className={`text-xl md:text-2xl font-extrabold mt-0.5 ${custody.textColor}`}>
                {custody.title}
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">{custody.subtitle}</p>
            </div>
          </div>

          {/* Deadline Countdown Box (when active) */}
          {latestEvent?.state === 'DEBITED' && (
            <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-xl border border-amber-500/30 self-start md:self-auto">
              <Clock className="w-5 h-5 text-amber-400 animate-spin" />
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  Bank B SLA Deadline
                </div>
                <div className="text-lg font-mono font-bold text-amber-400">
                  {secondsRemaining !== null ? `${secondsRemaining}s remaining` : '30s SLA Clock'}
                </div>
              </div>
            </div>
          )}

          {latestEvent?.state === 'STUCK' && (
            <div className="flex items-center gap-2.5 bg-rose-950/80 px-4 py-3 rounded-xl border border-rose-500/50 self-start md:self-auto">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-rose-300">
                  SLA Breached
                </div>
                <div className="text-base font-mono font-bold text-rose-400">
                  Flagged to Regulator
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reconnect & Checkpoint Replay Demo Banner */}
      <div className="p-4 rounded-xl glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">
              Checkpoint & Replay Layer: <span className="text-cyan-400 font-mono">lastSeq = #{lastSeq}</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              If client drops cellular connection, it reconnects with #{lastSeq} and catches up in 1 frame.
            </p>
          </div>
        </div>

        <button
          onClick={onSimulateCatchup}
          className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors font-medium shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Simulate Drop & Catch-Up
        </button>
      </div>

      {/* Signed Steps Timeline */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Cryptographically Verified Ledger Timeline
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Each step is an immutable transaction signed by the owning bank identity (MSP).
            </p>
          </div>
          <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
            Channel: pulsechannel
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 animate-spin" />
            Listening for block events from gateway...
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
            {timeline.map((item, index) => {
              const isLast = index === timeline.length - 1;
              const { event, seq } = item;

              return (
                <div key={`${event.id}-${seq}-${event.state}`} className="relative group">
                  {/* Step Dot */}
                  <div
                    className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      event.state === 'CREDITED'
                        ? 'border-emerald-400 bg-emerald-950 text-emerald-400 shadow-md shadow-emerald-500/30'
                        : event.state === 'STUCK'
                        ? 'border-rose-400 bg-rose-950 text-rose-400 shadow-md shadow-rose-500/30'
                        : event.state === 'DEBITED'
                        ? 'border-amber-400 bg-amber-950 text-amber-400 shadow-md shadow-amber-500/30'
                        : 'border-cyan-400 bg-cyan-950 text-cyan-400 shadow-md shadow-cyan-500/30'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  </div>

                  {/* Step Card */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    isLast ? 'bg-slate-900/90 border-slate-700 shadow-lg' : 'bg-slate-900/40 border-slate-800/80 opacity-90'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-md font-mono ${
                            event.state === 'CREDITED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : event.state === 'STUCK'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : event.state === 'DEBITED'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {event.state}
                        </span>

                        <span className="text-xs font-medium text-slate-300">
                          {event.state === 'INITIATED' && 'Instruction created & validated'}
                          {event.state === 'DEBITED' && 'Sender account debited'}
                          {event.state === 'CREDITED' && 'Beneficiary account credited'}
                          {event.state === 'STUCK' && 'Beneficiary deadline exceeded — Auto escalated'}
                          {event.state === 'REVERSED' && 'Funds returned to remitter'}
                          {event.state === 'DECLINED' && 'Payment declined at origin'}
                          {event.state === 'DISPUTED' && 'Dispute flagged for arbitration'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          Block #{seq}
                        </span>
                        <span>{new Date(event.at).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="text-slate-500">Signer:</span>
                        <span className="text-slate-200 font-semibold font-mono">
                          {event.state === 'INITIATED' || event.state === 'DEBITED' || event.state === 'REVERSED'
                            ? 'Org1MSP (Bank A)'
                            : event.state === 'CREDITED'
                            ? 'Org2MSP (Bank B)'
                            : event.state === 'STUCK'
                            ? 'Chaincode Escalator'
                            : 'Org2MSP / Arbiter'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-slate-500">Tx:</span>
                        <span className="text-slate-300 font-mono truncate" title={event.txId}>
                          {event.txId.slice(0, 14)}...
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-500">Custody:</span>
                        <span className="text-slate-300 font-medium font-mono">
                          {event.heldBy ? event.heldBy : 'None (Terminal)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
