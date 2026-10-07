import React from 'react';
import { Activity, ShieldCheck, Store, WifiOff } from 'lucide-react';

interface NavbarProps {
  activeTab: 'timeline' | 'merchant' | 'regulator';
  setActiveTab: (tab: 'timeline' | 'merchant' | 'regulator') => void;
  isConnected: boolean;
  isReplayMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({ activeTab, setActiveTab, isConnected, isReplayMode }) => {
  return (
    <header className="sticky top-0 z-50 bg-[#060B18]/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-cyan-500/10 to-teal-500/5 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                Pulse
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-medium">
                NPCI × Citi
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Verified Shared-Ledger Payment Status</p>
          </div>
        </div>

        {/* Navigation Tabs - Clean unified pill container */}
        <nav
          className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800/90 max-w-full overflow-x-auto no-scrollbar gap-1"
          role="tablist"
          aria-label="Main navigation"
        >
          <button
            onClick={() => setActiveTab('timeline')}
            role="tab"
            aria-selected={activeTab === 'timeline'}
            aria-controls="timeline-panel"
            className={`
              flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 shrink-0
              ${activeTab === 'timeline'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }
            `}
          >
            <Activity className="w-4 h-4" />
            <span>User Timeline</span>
          </button>
          <button
            onClick={() => setActiveTab('merchant')}
            role="tab"
            aria-selected={activeTab === 'merchant'}
            aria-controls="merchant-panel"
            className={`
              flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 shrink-0
              ${activeTab === 'merchant'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }
            `}
          >
            <Store className="w-4 h-4" />
            <span>Merchant POS</span>
          </button>
          <button
            onClick={() => setActiveTab('regulator')}
            role="tab"
            aria-selected={activeTab === 'regulator'}
            aria-controls="regulator-panel"
            className={`
              flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 shrink-0
              ${activeTab === 'regulator'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }
            `}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Regulator Audit</span>
          </button>
        </nav>

        {/* Connection Status - with Fixed Width and Stable Static Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`
              w-[130px] min-w-[130px] flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-colors duration-150 whitespace-nowrap
              ${isConnected
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }
            `}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20 shrink-0" />
                <span className="truncate">{isReplayMode ? 'Replay Mode' : 'WS Live'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Disconnected</span>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  );
});
