import React, { memo } from 'react';
import { Store, CheckCircle, Clock, QrCode, Zap, ShieldCheck, AlertTriangle, RefreshCw, Scale } from 'lucide-react';
import { PaymentEvent } from '../types/pulse';

interface MerchantViewProps {
  latestEvent: PaymentEvent | null;
  selectedScenario: string;
}

// ── Per-state display map ────────────────────────────────────────────────────

interface StateDisplay {
  title: string;
  subtitle: React.ReactNode;
  iconClass: string;   // Tailwind classes for icon container
  textClass: string;   // Tailwind text colour class
  icon: React.ReactElement;
}

function getStateDisplay(latestEvent: PaymentEvent | null): StateDisplay {
  const state = latestEvent?.state ?? null;

  switch (state) {
    case null:
      return {
        title: 'Awaiting Payment Initiation',
        subtitle: 'Scan the QR code or initiate transfer to begin.',
        iconClass: 'bg-slate-500/20 border-slate-500/40 text-slate-400',
        textClass: 'text-slate-400',
        icon: <Clock className="w-7 h-7" />,
      };

    case 'INITIATED':
      return {
        title: 'Payment Instruction Received',
        subtitle: (
          <>
            Current state:{' '}
            <span className="font-mono text-cyan-400 font-bold">INITIATED</span>. Awaiting Bank A debit confirmation.
          </>
        ),
        iconClass: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
        textClass: 'text-cyan-300',
        icon: <Clock className="w-7 h-7" />,
      };

    case 'DEBITED':
      return {
        title: 'Awaiting Bank B Endorsement\u2026',
        subtitle: (
          <>
            Current state:{' '}
            <span className="font-mono text-amber-400 font-bold">DEBITED</span>. Bank A debited. SLA clock running on Bank B.
          </>
        ),
        iconClass: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
        textClass: 'text-amber-300',
        icon: <Clock className="w-7 h-7" />,
      };

    case 'CREDITED':
      return {
        title: 'Payment Received & Verified',
        subtitle: 'Beneficiary bank signed attestation recorded on ledger block. Goods may be released immediately.',
        iconClass: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
        textClass: 'text-emerald-400',
        icon: <CheckCircle className="w-7 h-7" />,
      };

    case 'REVERSED':
      return {
        title: 'Payment Reversed \u2014 Do Not Release Goods',
        subtitle: 'Bank A reversed the debit. Funds returned to remitter. Await fresh payment instruction.',
        iconClass: 'bg-slate-500/20 border-slate-500/40 text-slate-400',
        textClass: 'text-slate-300',
        icon: <RefreshCw className="w-7 h-7" />,
      };

    case 'DISPUTED':
      return {
        title: 'DISPUTED \u2014 Custody Under Arbitration',
        subtitle:
          'Bank B credited after Bank A reversed. Conflicting attestations escalated to regulator. Hold funds until resolved.',
        iconClass: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
        textClass: 'text-purple-400',
        icon: <Scale className="w-7 h-7" />,
      };

    case 'STUCK':
      return {
        title: 'Payment Stuck / SLA Timeout',
        subtitle: 'Bank B failed to credit within 30 seconds. Do not release merchandise. Regulatory dispute opened.',
        iconClass: 'bg-rose-500/20 border-rose-500/40 text-rose-400',
        textClass: 'text-rose-400',
        icon: <AlertTriangle className="w-7 h-7" />,
      };

    case 'DECLINED':
      return {
        title: 'Payment Declined',
        subtitle:
          'Bank A declined the instruction (insufficient funds or policy restriction). Request fresh payment.',
        iconClass: 'bg-rose-500/20 border-rose-500/40 text-rose-400',
        textClass: 'text-rose-400',
        icon: <AlertTriangle className="w-7 h-7" />,
      };

    default:
      return {
        title: `Status: ${(latestEvent as any)?.state ?? 'UNKNOWN'}`,
        subtitle: 'State updated on shared ledger.',
        iconClass: 'bg-slate-500/20 border-slate-500/40 text-slate-400',
        textClass: 'text-slate-300',
        icon: <Clock className="w-7 h-7" />,
      };
  }
}

export const MerchantView: React.FC<MerchantViewProps> = memo(function MerchantView({
  latestEvent,
  selectedScenario,
}) {
  const display = getStateDisplay(latestEvent);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Merchant Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 min-h-[96px]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Citi Merchant Terminal</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono whitespace-nowrap">
                Store ID #CITI-882
              </span>
            </div>
            <p className="text-xs text-slate-400">Instant push settlement via shared Drunix ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
            Channel: Org2MSP (Beneficiary)
          </span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 shrink-0" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Order Details & QR Simulation */}
        <div className="md:col-span-1 glass-card rounded-2xl p-5 border border-slate-800 flex flex-col items-center text-center justify-between min-h-[420px]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono font-medium whitespace-nowrap">
              Active Invoice
            </span>
            <div className="text-3xl font-extrabold text-slate-100 mt-2 font-mono tabular-nums">
              &#8377;450.00
            </div>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">Order #ORD-2026-9921</p>

            <div className="my-5 p-3 rounded-xl bg-white shadow-inner flex items-center justify-center">
              <div className="w-36 h-36 border-2 border-dashed border-slate-900 rounded-lg flex flex-col items-center justify-center bg-slate-50 text-slate-900">
                <QrCode className="w-28 h-28 text-slate-900" />
              </div>
            </div>
          </div>

          <div className="w-full text-left space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-medium whitespace-nowrap">Mithunn (mithunn@citi)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remitter Bank:</span>
              <span className="font-mono text-cyan-400 whitespace-nowrap">Org1MSP (Bank A)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Beneficiary Bank:</span>
              <span className="font-mono text-emerald-400 whitespace-nowrap">Org2MSP (Bank B)</span>
            </div>
          </div>
        </div>

        {/* Real-time Status Card with Stable Layout */}
        <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between min-h-[420px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400 whitespace-nowrap">
                Payment Verification State
              </span>
              <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
                Ref: {latestEvent?.id || selectedScenario}
              </span>
            </div>

            {/* Stable sized state container */}
            <div className="mt-6 mb-8 min-h-[140px] flex items-center">
              <div className="flex items-start gap-4 w-full">
                <div
                  className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 ${display.iconClass}`}
                >
                  {display.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className={`text-2xl font-extrabold ${display.textClass}`}>
                    {display.title}
                  </h3>

                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    {display.subtitle}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Efficiency Callout with Fixed Heights */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 gap-4 text-xs min-h-[72px]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-slate-400 text-[11px] whitespace-nowrap">Polling Overhead</div>
                <div className="text-sm font-bold text-slate-100 font-mono tabular-nums whitespace-nowrap">
                  0 requests
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-slate-400 text-[11px] whitespace-nowrap">Proof Mechanism</div>
                <div className="text-sm font-bold text-slate-100 font-mono whitespace-nowrap">
                  Signed Fabric Event
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
