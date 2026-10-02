import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { PaymentTimeline } from './components/PaymentTimeline';
import { MerchantView } from './components/MerchantView';
import { RegulatorDashboard } from './components/RegulatorDashboard';
import { usePulseStream } from './hooks/usePulseStream';
import { Play, AlertOctagon, CheckCircle2, RefreshCw, GitCommit } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'merchant' | 'regulator'>('timeline');
  const [selectedScenario, setSelectedScenario] = useState<string>('happy_path');

  // Check if replay mode env flag is on
  const isReplayMode = import.meta.env.VITE_MODE === 'replay';

  const {
    timeline,
    latestEvent,
    isConnected,
    lastSeq,
    metrics,
    error,
    connect,
    disconnect,
  } = usePulseStream({
    paymentId: selectedScenario,
    isReplayMode,
  });

  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleSimulateCatchup = () => {
    // Drop connection, then reconnect to prove lastSeq replay
    disconnect();
    setTimeout(() => {
      connect();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <div>
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedScenario={selectedScenario}
          setSelectedScenario={setSelectedScenario}
          isConnected={isConnected}
          isReplayMode={isReplayMode}
          toggleConnection={toggleConnection}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          {/* Quick Scenario Runner Bar */}
          <div className="mb-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-mono text-cyan-400 font-semibold uppercase text-[11px]">Quick Scenarios:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedScenario('happy_path')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  selectedScenario === 'happy_path'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Happy Path
              </button>

              <button
                onClick={() => setSelectedScenario('bank_b_silent')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  selectedScenario === 'bank_b_silent'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                Bank B Goes Silent (SLA Stuck)
              </button>

              <button
                onClick={() => setSelectedScenario('disputed_case')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  selectedScenario === 'disputed_case'
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                Disputed State
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          {activeTab === 'timeline' && (
            <PaymentTimeline
              timeline={timeline}
              latestEvent={latestEvent}
              lastSeq={lastSeq}
              isConnected={isConnected}
              onSimulateCatchup={handleSimulateCatchup}
            />
          )}

          {activeTab === 'merchant' && (
            <MerchantView
              latestEvent={latestEvent}
              selectedScenario={selectedScenario}
            />
          )}

          {activeTab === 'regulator' && (
            <RegulatorDashboard
              metrics={metrics}
              latestEvent={latestEvent}
              selectedScenario={selectedScenario}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Pulse</span>
            <span>— Real-Time Payments Track | DRUNIX Hackathon 2026</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span>Dharmik (Ledger)</span>
            <span>•</span>
            <span>Ritu (Backend)</span>
            <span>•</span>
            <span className="text-cyan-400 font-semibold">Mithunn (Frontend & Delivery)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
