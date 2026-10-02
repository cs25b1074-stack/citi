import React from 'react';
import {
  ShieldAlert,
  BarChart3,
  Server,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { GatewayMetrics, PaymentEvent } from '../types/pulse';

interface RegulatorDashboardProps {
  metrics: GatewayMetrics;
  latestEvent: PaymentEvent | null;
  selectedScenario: string;
}

export const RegulatorDashboard: React.FC<RegulatorDashboardProps> = ({
  metrics,
  latestEvent,
  selectedScenario,
}) => {
  // Chart comparison data
  const comparisonData = [
    { name: 'Traditional Polling', requests: 12, bandwidth: 2840, latency: 850 },
    { name: 'Pulse (Push + Ledger)', requests: 1, bandwidth: 520, latency: 15 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 via-sky-500 to-indigo-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <ShieldAlert className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">NPCI / RBI Regulatory Audit Desk</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                Org3MSP (Read-Only)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live multi-org transaction oversight, SLA enforcement & dispute ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          Consensus: Fabric 2.5 (Raft)
        </div>
      </div>

      {/* Gateway Live Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            HTTP Requests Served
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
            {metrics.requestsServed}
          </div>
          <div className="text-[11px] text-cyan-400 mt-1 flex items-center gap-1">
            <Server className="w-3 h-3" /> Gateway REST + Baseline
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            Events Pushed
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {metrics.eventsPushed}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Over WebSocket
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            Replayed Blocks
          </div>
          <div className="text-2xl font-bold text-cyan-300 font-mono mt-1">
            {metrics.replays}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" /> Reconnected clients
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            SLA Escalations
          </div>
          <div className={`text-2xl font-bold font-mono mt-1 ${metrics.escalations > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {metrics.escalations > 0 ? metrics.escalations : (selectedScenario === 'bank_b_silent' ? 1 : 0)}
          </div>
          <div className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> STUCK transactions
          </div>
        </div>
      </div>

      {/* Audit Table & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA Escalation Audit Table */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              SLA Timeout & Stuck Payments Log
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Policy: 30s Hard Cap</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Payment ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Defaulting Org</th>
                  <th className="py-2.5 px-3">Escalated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {selectedScenario === 'bank_b_silent' || latestEvent?.state === 'STUCK' ? (
                  <tr className="bg-rose-950/20 text-rose-300">
                    <td className="py-3 px-3 font-semibold">bank_b_silent</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700 text-rose-300 text-[10px] font-bold">
                        STUCK
                      </span>
                    </td>
                    <td className="py-3 px-3 text-amber-300">Org2MSP (Bank B)</td>
                    <td className="py-3 px-3 text-slate-400">30s post-debit</td>
                  </tr>
                ) : null}

                {selectedScenario === 'disputed_case' || latestEvent?.state === 'DISPUTED' ? (
                  <tr className="bg-purple-950/20 text-purple-300">
                    <td className="py-3 px-3 font-semibold">disputed_case</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700 text-purple-300 text-[10px] font-bold">
                        DISPUTED
                      </span>
                    </td>
                    <td className="py-3 px-3 text-purple-300">Dual Attestation</td>
                    <td className="py-3 px-3 text-slate-400">Late Credit</td>
                  </tr>
                ) : null}

                <tr className="text-slate-300 hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 text-slate-400">tx-audit-881</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px]">
                      CREDITED
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">None (Cleared)</td>
                  <td className="py-2.5 px-3 text-slate-500">Normal SLA</td>
                </tr>

                <tr className="text-slate-300 hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 text-slate-400">tx-audit-882</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px]">
                      CREDITED
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">None (Cleared)</td>
                  <td className="py-2.5 px-3 text-slate-500">Normal SLA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Requests & Latency Comparison Bar Chart */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Network Load: Requests per Pending Payment
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> 92% Reduction
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={130} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="requests" name="Total Requests" radius={[0, 4, 4, 0]}>
                    <Cell fill="#f43f5e" />
                    <Cell fill="#06b6d4" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Discovery Latency:</span>
            <span className="font-mono text-slate-200">
              Traditional: <span className="text-rose-400">~850ms</span> vs Pulse: <span className="text-emerald-400">&lt; 15ms</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
