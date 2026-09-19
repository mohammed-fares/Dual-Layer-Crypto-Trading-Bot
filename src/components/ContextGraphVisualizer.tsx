import React, { useState } from 'react';
import { CryptoAsset } from '../types';
import { Network, Zap, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

interface Props {
  assets: Record<string, CryptoAsset>;
  leaders: string[];
  followersMap: Record<string, { symbol: string; correlation: number }[]>;
  activeSurgeLeader: string | null;
  selectedAsset: string | null;
  onSelectAsset: (symbol: string) => void;
}

export const ContextGraphVisualizer: React.FC<Props> = ({
  assets,
  leaders,
  followersMap,
  activeSurgeLeader,
  selectedAsset,
  onSelectAsset,
}) => {
  const [filterSector, setFilterSector] = useState<string>('ALL');

  const symbols = Object.keys(assets);
  const sectors = Array.from(new Set(symbols.map((s) => assets[s]?.sector || 'Other'))).sort();

  // 2D Layout calculations: Place nodes in a structured circular / orbital graph
  const width = 760;
  const height = 480;
  const centerX = width / 2;
  const centerY = height / 2;

  // Leaders in inner orbital ring, others in outer ring
  const leaderSymbols = symbols.filter((s) => leaders.includes(s));
  const otherSymbols = symbols.filter((s) => !leaders.includes(s));

  const nodePositions: Record<string, { x: number; y: number }> = {};

  // Inner ring for leaders
  leaderSymbols.forEach((sym, i) => {
    const angle = (i / Math.max(leaderSymbols.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = 110;
    nodePositions[sym] = {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  });

  // Outer ring for followers
  otherSymbols.forEach((sym, i) => {
    const angle = (i / Math.max(otherSymbols.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = 205;
    nodePositions[sym] = {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  });

  // Calculate edges: Leader to follower where correlation > 0.75
  const edges: { from: string; to: string; corr: number }[] = [];
  leaders.forEach((lead) => {
    const followers = followersMap[lead] || [];
    followers.forEach((f) => {
      if (f.correlation >= 0.75) {
        edges.push({ from: lead, to: f.symbol, corr: f.correlation });
      }
    });
  });

  const activeFocus = selectedAsset || activeSurgeLeader || leaders[0] || 'BTCUSDT';
  const activeFocusData = assets[activeFocus];
  const focusedFollowers = followersMap[activeFocus] || [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Context Graph Engine (The Brain)
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Swarm Active: 25 Nodes
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Dynamic correlation network (r &gt; 0.75). Highlighted leaders trigger sniper alerts for lagging followers.
            </p>
          </div>
        </div>

        {/* Sector Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sector:</span>
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Sectors ({symbols.length})</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Graph Area & Focus Info Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        {/* SVG Graph Canvas */}
        <div className="lg:col-span-3 bg-slate-950/70 border border-slate-800/80 rounded-lg relative overflow-hidden flex items-center justify-center p-2 min-h-[380px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[460px] select-none">
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* Background Glow */}
            <circle cx={centerX} cy={centerY} r={220} fill="url(#centerGlow)" />
            {/* Orbital Guide Rings */}
            <circle cx={centerX} cy={centerY} r={110} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={centerX} cy={centerY} r={205} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

            {/* Orbit Labels */}
            <text x={centerX} y={centerY - 116} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
              LEADERS ORBIT
            </text>
            <text x={centerX} y={centerY - 212} fill="#475569" fontSize="10" textAnchor="middle" fontFamily="monospace">
              CORRELATED FOLLOWERS
            </text>

            {/* Edges */}
            {edges.map((edge, idx) => {
              const p1 = nodePositions[edge.from];
              const p2 = nodePositions[edge.to];
              if (!p1 || !p2) return null;

              const isHighlighted = edge.from === activeFocus || edge.to === activeFocus;
              const isSurgeEdge = edge.from === activeSurgeLeader;

              return (
                <line
                  key={`${edge.from}-${edge.to}-${idx}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={
                    isSurgeEdge
                      ? '#eab308'
                      : isHighlighted
                      ? '#38bdf8'
                      : '#334155'
                  }
                  strokeWidth={isSurgeEdge ? 2.5 : isHighlighted ? 1.8 : 0.8}
                  strokeOpacity={isSurgeEdge ? 0.9 : isHighlighted ? 0.75 : 0.25}
                  strokeDasharray={isSurgeEdge ? '4 2' : 'none'}
                />
              );
            })}

            {/* Nodes */}
            {symbols.map((sym) => {
              const pos = nodePositions[sym];
              if (!pos) return null;
              const asset = assets[sym];
              const isLeader = leaders.includes(sym);
              const isSelected = selectedAsset === sym;
              const isSurging = activeSurgeLeader === sym;
              const isLaggingFollower =
                activeSurgeLeader &&
                followersMap[activeSurgeLeader]?.some((f) => f.symbol === sym) &&
                (asset?.change1m || 0) < 0.3;

              const inFilter = filterSector === 'ALL' || asset?.sector === filterSector;
              const opacity = inFilter ? 1 : 0.25;

              return (
                <g
                  key={sym}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => onSelectAsset(sym)}
                  className="cursor-pointer transition-transform duration-150 hover:scale-110"
                  opacity={opacity}
                >
                  {/* Pulse effect for surging leader */}
                  {isSurging && (
                    <circle r="22" fill="none" stroke="#eab308" strokeWidth="2" className="animate-ping" opacity="0.6" />
                  )}

                  {/* Sniper Target Highlight */}
                  {isLaggingFollower && (
                    <circle r="20" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="3 2" className="animate-spin" />
                  )}

                  {/* Main Circle */}
                  <circle
                    r={isLeader ? 14 : 11}
                    fill={
                      isSurging
                        ? '#ca8a04'
                        : isLeader
                        ? '#4f46e5'
                        : isLaggingFollower
                        ? '#0891b2'
                        : isSelected
                        ? '#0284c7'
                        : '#1e293b'
                    }
                    stroke={
                      isSelected
                        ? '#38bdf8'
                        : isSurging
                        ? '#fef08a'
                        : isLeader
                        ? '#818cf8'
                        : '#475569'
                    }
                    strokeWidth={isSelected || isSurging ? 2.5 : 1.5}
                  />

                  {/* Symbol Label */}
                  <text
                    y={isLeader ? 22 : 18}
                    fill={isSelected ? '#38bdf8' : isLeader ? '#c7d2fe' : '#94a3b8'}
                    fontSize={isLeader ? 9 : 8}
                    fontWeight={isLeader ? 'bold' : 'normal'}
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {sym.replace('USDT', '')}
                  </text>

                  {/* 1m Change badge */}
                  <text
                    y={-14}
                    fill={(asset?.change1m || 0) >= 0 ? '#4ade80' : '#f87171'}
                    fontSize="7"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {(asset?.change1m || 0) >= 0 ? '+' : ''}
                    {(asset?.change1m || 0).toFixed(2)}%
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Quick Graph Legend */}
          <div className="absolute bottom-2 left-2 flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-md text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-indigo-400"></span> Leader
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-500"></span> Follower
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-yellow-200"></span> Surge (&gt;1.5%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 border border-cyan-300"></span> Lagging Target
            </span>
          </div>
        </div>

        {/* Selected Asset Details Sidebar */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-slate-100">{activeFocus}</span>
                {leaders.includes(activeFocus) ? (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    LEADER
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400 font-semibold">
                    FOLLOWER
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-mono">
                ${activeFocusData?.price?.toFixed(activeFocusData.price < 1 ? 5 : 2)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Sector:</span>
                <span className="text-slate-200 font-medium">{activeFocusData?.sector || 'Crypto'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>1-Min Move:</span>
                <span
                  className={`font-mono font-semibold ${
                    (activeFocusData?.change1m || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(activeFocusData?.change1m || 0) >= 0 ? '+' : ''}
                  {(activeFocusData?.change1m || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>24h Change:</span>
                <span
                  className={`font-mono ${
                    (activeFocusData?.change24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(activeFocusData?.change24h || 0) >= 0 ? '+' : ''}
                  {(activeFocusData?.change24h || 0).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Correlated Followers section */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Correlated Peers (r &gt; 0.75):</span>
                <span className="text-[11px] text-slate-500 font-mono">{focusedFollowers.length} edges</span>
              </div>

              {focusedFollowers.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No correlation edges exceeding r=0.75 registered yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {focusedFollowers.map((f) => {
                    const peerAsset = assets[f.symbol];
                    const peerMove = peerAsset?.change1m || 0;
                    const isLagging = peerMove < 0.3;

                    return (
                      <div
                        key={f.symbol}
                        onClick={() => onSelectAsset(f.symbol)}
                        className={`p-1.5 rounded border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          isLagging
                            ? 'bg-cyan-950/40 border-cyan-800/60 hover:bg-cyan-900/40'
                            : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-slate-200">
                            {f.symbol.replace('USDT', '')}
                          </span>
                          {isLagging && (
                            <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded font-mono">
                              LAGGING
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-slate-400">r={f.correlation.toFixed(2)}</span>
                          <span className={peerMove >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {peerMove >= 0 ? '+' : ''}
                            {peerMove.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sniper Rule Checklist */}
          <div className="mt-3 p-2 bg-slate-900/90 border border-slate-800 rounded text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Sniper Trigger Rule:
            </div>
            <div>• Leader surge &gt; 1.5% in 60s</div>
            <div>• Follower correlation &gt; 0.75 &amp; 1m move &lt; 0.3%</div>
            <div>• TP: +2.5% | SL: -1.2% | Cooldown: 15m</div>
          </div>
        </div>
      </div>
    </div>
  );
};
