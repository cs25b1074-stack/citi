import React from 'react';
import { Store, CheckCircle, Clock, QrCode, ArrowUpRight, Zap, ShieldCheck } from 'lucide-react';
import { PaymentEvent } from '../types/pulse';

interface MerchantViewProps {
  latestEvent: PaymentEvent | null;
  selectedScenario: string;
}

export const MerchantView: React.FC<MerchantViewProps> = ({ latestEvent, selectedScenario }) => {
  const isSettled = latestEvent?.state === 'CREDITED';
  const isStuck = latestEvent?.state === 'STUCK';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Merchant Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Citi Merchant Terminal</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono">
                Store ID #CITI-882
              </span>
            </div>
            <p className="text-xs text-slate-400">Instant push settlement via shared Drunix ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Channel: Org2MSP (Beneficiary)</span>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Order Details & QR Simulation */}
        <div className="md:col-span-1 glass-card rounded-2xl p-5 border border-slate-800 flex flex-col items-center text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono font-medium">
            Active Invoice
          </span>
          <div className="text-3xl font-extrabold text-slate-100 mt-2 font-mono">
            ₹450.00
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Order #ORD-2026-9921</p>

          <div className="my-5 p-4 rounded-xl bg-white p-3 shadow-inner">
            <div className="w-36 h-36 border-2 border-dashed border-slate-900 rounded-lg flex flex-col items-center justify-center bg-slate-50 text-slate-900">
              <QrCode className="w-28 h-28 text-slate-900" />
            </div>
          </div>

          <div className="w-full text-left space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-medium">Mithunn (mithunn@citi)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remitter Bank:</span>
              <span className="font-mono text-cyan-400">Org1MSP (Bank A)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Beneficiary Bank:</span>
              <span className="font-mono text-emerald-400">Org2MSP (Bank B)</span>
            </div>
          </div>
        </div>

        {/* Real-time Status Card */}
        <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
                Payment Verification State
              </span>
              <span className="text-xs font-mono text-slate-500">
                Ref: {latestEvent?.id || selectedScenario}
              </span>
            </div>

            <div className="mt-6 mb-8 text-center sm:text-left">
              {isSettled ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-emerald-400">
                      Payment Received & Verified
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md">
                      Beneficiary bank signed attestation recorded on ledger block. Goods may be released immediately.
                    </p>
                  </div>
                </div>
              ) : isStuck ? (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-rose-400">
                      Payment Stuck / SLA Timeout
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md">
                      Bank B failed to credit within 30 seconds. Do not release merchandise. Regulatory dispute opened.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 animate-pulse">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-cyan-300">
                      Awaiting Bank B Endorsement...
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md">
                      Current state: <span className="font-mono text-amber-400 font-bold">{latestEvent?.state || 'INITIATED'}</span>.
                      Listening for push confirmation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Efficiency Callout */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Polling Overhead</div>
                <div className="text-sm font-bold text-slate-100 font-mono">0 requests</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Proof Mechanism</div>
                <div className="text-sm font-bold text-slate-100 font-mono">Signed Fabric Event</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
