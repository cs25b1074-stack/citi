import React, { useState } from 'react';
import { CheckCircle2, Clock, Scale } from 'lucide-react';
import {
  PulseProvider,
  usePulseConnection,
  usePulseEvents,
  usePulseMetrics,
} from './context/PulseContext';
import { Navbar } from './components/Navbar';
import { PaymentTimeline } from './components/PaymentTimeline';
import { MerchantView } from './components/MerchantView';
import { RegulatorDashboard } from './components/RegulatorDashboard';
import { PaymentEvent } from './types/pulse';

const RegulatorTab = React.memo(function RegulatorTab({
  latestEvent,
  selectedScenario,
}: {
  latestEvent: PaymentEvent | null;
  selectedScenario: string;
}) {
  const { metrics } = usePulseMetrics();
  return (
    <RegulatorDashboard
      metrics={metrics}
      latestEvent={latestEvent}
      selectedScenario={selectedScenario}
    />
  );
});

function AppContent() {
  const { isConnected, isReplayMode } = usePulseConnection();
  const {
    selectedScenario,
    setSelectedScenario,
    timeline,
    latestEvent,
    lastSeq,
    simulateCatchup,
  } = usePulseEvents();
  const [activeTab, setActiveTab] = useState<'timeline' | 'merchant' | 'regulator'>('timeline');

  return (
    <div className="min-h-[100dvh] bg-[#070a11] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        isReplayMode={isReplayMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-16 mt-6">
        {/* Demo Controls (merged scenario selector + quick buttons) */}
        <DemoControls
          selectedScenario={selectedScenario}
          setSelectedScenario={setSelectedScenario}
        />

        {/* Tab Panels with 24px (space-y-6) spacing and instant smooth fade-in */}
        <div className="space-y-6">
          <div
            className={activeTab === 'timeline' ? 'block animate-fade-in' : 'hidden'}
            role="tabpanel"
            aria-label="User Timeline"
          >
            <PaymentTimeline
              timeline={timeline}
              latestEvent={latestEvent}
              lastSeq={lastSeq}
              isConnected={isConnected}
              onSimulateCatchup={simulateCatchup}
            />
          </div>

          <div
            className={activeTab === 'merchant' ? 'block animate-fade-in' : 'hidden'}
            role="tabpanel"
            aria-label="Merchant POS"
          >
            <MerchantView
              latestEvent={latestEvent}
              selectedScenario={selectedScenario}
            />
          </div>

          <div
            className={activeTab === 'regulator' ? 'block animate-fade-in' : 'hidden'}
            role="tabpanel"
            aria-label="Regulator Audit"
          >
            <RegulatorTab
              latestEvent={latestEvent}
              selectedScenario={selectedScenario}
            />
          </div>
        </div>
      </main>

      {/* Footer in normal flow with mt-auto */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-5 text-slate-400">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-300">Pulse</span>
            <span>— Real-Time Payments Track | DRUNIX Hackathon 2026</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-cyan-400 font-semibold">Dharmik (Ledger)</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-semibold">Ritu (Backend)</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-semibold">Mithunn (Frontend &amp; Delivery)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const DemoControls = React.memo(function DemoControls({
  selectedScenario,
  setSelectedScenario,
}: {
  selectedScenario: string;
  setSelectedScenario: (id: string) => void;
}) {
  const { isReplayMode } = usePulseConnection();
  const { appendMockEvent } = usePulseEvents();

  const scenarios = [
    {
      id: 'happy_path',
      label: 'Happy Path',
      desc: 'Instant Credit (5s)',
      icon: CheckCircle2,
      states: ['INITIATED', 'DEBITED', 'CREDITED'] as const,
    },
    {
      id: 'bank_b_silent',
      label: 'Bank B Silent',
      desc: 'SLA Stuck Escalate (30s)',
      icon: Clock,
      states: ['INITIATED', 'DEBITED', 'STUCK'] as const,
    },
    {
      id: 'disputed_case',
      label: 'Disputed State',
      desc: 'Late Credit vs Reversal',
      icon: Scale,
      states: ['INITIATED', 'DEBITED', 'CREDITED', 'DISPUTED'] as const,
    },
  ] as const;

  type Scenario = typeof scenarios[number];

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario.id);
    if (isReplayMode) {
      scenario.states.forEach((state, i) => {
        setTimeout(() => appendMockEvent(scenario.id, state), i * 500);
      });
    }
  };

  return (
    <div className="pulse-card p-4 sm:p-5 rounded-2xl mb-6 min-h-[110px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3.5">
        <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400 font-semibold whitespace-nowrap">
          Demo Controls (Scenario Simulator)
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-400 font-mono w-fit whitespace-nowrap">
          Interactive Mock Mode
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Demo scenarios">
        {scenarios.map((s) => {
          const Icon = s.icon;
          const isSelected = selectedScenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleScenarioSelect(s)}
              role="radio"
              aria-checked={isSelected}
              className={`
                group flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left min-h-[56px]
                transition-[color,background-color,border-color,box-shadow] duration-150 ease-out cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060B18]
                ${isSelected
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_20px_-3px_rgba(34,211,238,0.25)]'
                  : 'border-slate-800/80 bg-slate-900/40 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                }
              `}
            >
              <div
                className={`
                  w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors duration-150
                  ${isSelected
                    ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
                  }
                `}
              >
                <Icon className="w-5 h-5 text-current shrink-0" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-semibold truncate text-slate-100">{s.label}</span>
                <span className="text-[11px] font-mono text-slate-400 truncate">{s.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export function App() {
  return (
    <PulseProvider>
      <AppContent />
    </PulseProvider>
  );
}

export default App;