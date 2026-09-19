import React, { useRef, useEffect } from 'react';
import { TerminalLog } from '../types';
import { Terminal, Trash2, Shield, Zap } from 'lucide-react';

interface Props {
  logs: TerminalLog[];
  onClearLogs?: () => void;
  onSimulateSurge?: (symbol: string) => void;
  symbols: string[];
}

export const TerminalView: React.FC<Props> = ({
  logs,
  onClearLogs,
  onSimulateSurge,
  symbols,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (type: TerminalLog['type']) => {
    switch (type) {
      case 'SNIPER':
        return 'text-cyan-300 font-semibold';
      case 'TRADE':
        return 'text-emerald-300 font-bold';
      case 'BRAIN':
        return 'text-indigo-300';
      case 'WARN':
        return 'text-amber-300';
      case 'ERROR':
        return 'text-rose-400 font-bold';
      case 'SUCCESS':
        return 'text-emerald-400';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col font-mono text-xs">
      {/* Terminal Titlebar (Kali Linux style) */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-slate-400 text-xs ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            root@kali: ~/binance_dual_bot — DualLayerBot Asyncio Stream
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSimulateSurge && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-500">Test Trigger:</span>
              <button
                onClick={() => onSimulateSurge('SOLUSDT')}
                className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded hover:bg-yellow-500/30 flex items-center gap-1"
                title="Simulate a sudden surge (+1.8%) on SOL to trigger sniper on lagging follower"
              >
                <Zap className="w-3 h-3" /> Surge SOL (+1.8%)
              </button>
              <button
                onClick={() => onSimulateSurge('BTCUSDT')}
                className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded hover:bg-indigo-500/30"
                title="Simulate a sudden surge on BTC"
              >
                Surge BTC
              </button>
            </div>
          )}

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
              title="Clear terminal logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Body */}
      <div className="p-4 bg-slate-950/95 overflow-y-auto max-h-[460px] min-h-[300px] space-y-1.5 leading-relaxed selection:bg-indigo-600 selection:text-white">
        <div className="text-slate-500 text-[11px] pb-2 border-b border-slate-900">
          Kali Linux x86_64 | Python 3.11.x | Asyncio Swarm &amp; Public WebSocket Worker Active
        </div>

        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2 break-words">
            <span className="text-slate-600 text-[11px] shrink-0 select-none">
              [{log.timestamp}]
            </span>
            <span className="text-indigo-400 font-semibold shrink-0 select-none">
              [{log.type}]
            </span>
            <span className={`${getLogColor(log.type)} whitespace-pre-wrap`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Command Prompt Status Bar */}
      <div className="bg-slate-900/90 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">● ONLINE</span>
          <span>Binance wss://stream.binance.com:9443 (25 miniTickers)</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span>Target Count: {symbols.length}</span>
          <span>Logs: {logs.length}</span>
        </div>
      </div>
    </div>
  );
};
