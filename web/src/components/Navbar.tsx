import React from 'react';
import { Activity, ShieldCheck, Store, RefreshCw, Radio, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  activeTab: 'timeline' | 'merchant' | 'regulator';
  setActiveTab: (tab: 'timeline' | 'merchant' | 'regulator') => void;
  selectedScenario: string;
  setSelectedScenario: (id: string) => void;
  isConnected: boolean;
  isReplayMode: boolean;
  toggleConnection: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedScenario,
  setSelectedScenario,
  isConnected,
  isReplayMode,
  toggleConnection,
}) => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-6 py-3.5 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-400 to-indigo-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                Pulse
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-400 font-mono font-medium">
                NPCI × Citi
              </span>
            </div>
            <p className="text-xs text-slate-400">Verified Shared-Ledger Payment Status</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            User Timeline
          </button>
          <button
            onClick={() => setActiveTab('merchant')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'merchant'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Merchant POS
          </button>
          <button
            onClick={() => setActiveTab('regulator')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'regulator'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Regulator Audit
          </button>
        </nav>

        {/* Controls & Connection */}
        <div className="flex items-center gap-3">
          {/* Scenario Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-mono">Scenario:</span>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="bg-transparent text-cyan-300 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="happy_path" className="bg-slate-900 text-slate-100">Happy Path (Instant Credit)</option>
              <option value="bank_b_silent" className="bg-slate-900 text-slate-100">Bank B Silent (SLA Stuck)</option>
              <option value="disputed_case" className="bg-slate-900 text-slate-100">Disputed (Late Credit)</option>
            </select>
          </div>

          {/* Connection Indicator & Toggle Button */}
          <button
            onClick={toggleConnection}
            title={isConnected ? "Click to simulate network disconnection" : "Click to reconnect and replay missed blocks"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isConnected
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-400 hover:bg-rose-900/60'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>{isReplayMode ? 'Replay Mode' : 'WS Live'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Disconnected (Reconnect)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
