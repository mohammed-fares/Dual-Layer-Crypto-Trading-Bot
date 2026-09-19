import React, { useState } from 'react';
import { CryptoAsset } from '../types';
import { Table, ArrowUpDown, Filter } from 'lucide-react';

interface Props {
  assets: Record<string, CryptoAsset>;
  matrix: Record<string, Record<string, number>>;
  leaders: string[];
}

export const CorrelationMatrixView: React.FC<Props> = ({ assets, matrix, leaders }) => {
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [minCorrFilter, setMinCorrFilter] = useState<number>(0.75);

  const symbols = Object.keys(assets);
  const sectors = Array.from(new Set(symbols.map((s) => assets[s]?.sector || 'Other'))).sort();

  const filteredSymbols = selectedSector === 'ALL'
    ? symbols
    : symbols.filter((s) => assets[s]?.sector === selectedSector);

  // Find top correlated pairs
  const pairs: { sym1: string; sym2: string; corr: number }[] = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const s1 = symbols[i];
      const s2 = symbols[j];
      const r = matrix[s1]?.[s2] ?? 0;
      if (Math.abs(r) >= minCorrFilter) {
        pairs.push({ sym1: s1, sym2: s2, corr: r });
      }
    }
  }
  pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));

  const getHeatmapColor = (val: number) => {
    if (val >= 0.85) return 'bg-emerald-600/80 text-white font-bold';
    if (val >= 0.75) return 'bg-emerald-500/50 text-emerald-200 font-semibold';
    if (val >= 0.50) return 'bg-emerald-950/60 text-emerald-300';
    if (val >= 0.20) return 'bg-slate-800/80 text-slate-300';
    if (val >= -0.20) return 'bg-slate-900 text-slate-500';
    if (val >= -0.50) return 'bg-rose-950/60 text-rose-300';
    return 'bg-rose-600/70 text-white font-semibold';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Pearson Correlation Matrix (25x25)
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                Swarm Engine: pandas.corr()
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Evaluated every 2 minutes. Correlation threshold &gt; 0.75 qualifies assets for follower-sniper pairs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Threshold:</span>
            <select
              value={minCorrFilter}
              onChange={(e) => setMinCorrFilter(parseFloat(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-md px-2 py-1"
            >
              <option value={0.75}>r &ge; 0.75 (Sniper Standard)</option>
              <option value={0.60}>r &ge; 0.60 (Moderate)</option>
              <option value={0.85}>r &ge; 0.85 (Strongest)</option>
              <option value={0.0}>All Pairs</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-md px-2 py-1"
            >
              <option value="ALL">All Sectors</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top High Correlation Qualified Pairs Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          Active High-Correlation Pairs (r &ge; {minCorrFilter}) [{pairs.length} detected]
        </h3>

        {pairs.length === 0 ? (
          <div className="p-4 bg-slate-950/60 rounded-lg text-xs text-slate-400 text-center">
            No coin pairs currently meet the selected threshold r &ge; {minCorrFilter}.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
            {pairs.slice(0, 18).map((p) => {
              const isLeader1 = leaders.includes(p.sym1);
              const isLeader2 = leaders.includes(p.sym2);

              return (
                <div
                  key={`${p.sym1}-${p.sym2}`}
                  className="bg-slate-950/80 border border-slate-800 p-2 rounded-lg flex flex-col justify-between text-xs"
                >
                  <div className="flex items-center justify-between font-mono font-medium">
                    <span className={isLeader1 ? 'text-indigo-400 font-bold' : 'text-slate-200'}>
                      {p.sym1.replace('USDT', '')}
                    </span>
                    <span className="text-slate-500 text-[10px]">&harr;</span>
                    <span className={isLeader2 ? 'text-indigo-400 font-bold' : 'text-slate-200'}>
                      {p.sym2.replace('USDT', '')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500">Correlation</span>
                    <span className={`font-mono text-[11px] px-1.5 rounded ${getHeatmapColor(p.corr)}`}>
                      {p.corr.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Heatmap Table */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
          Interactive Matrix Heatmap
        </h3>

        <div className="overflow-x-auto max-h-[360px] border border-slate-800 rounded-lg">
          <table className="w-full text-[11px] font-mono border-collapse select-none">
            <thead className="sticky top-0 bg-slate-950 z-10 shadow">
              <tr>
                <th className="p-2 border-b border-r border-slate-800 text-left text-slate-400 bg-slate-950 min-w-[70px]">
                  ASSET
                </th>
                {filteredSymbols.map((sym) => (
                  <th
                    key={sym}
                    className="p-1.5 border-b border-slate-800 text-center text-slate-300 min-w-[45px]"
                  >
                    {sym.replace('USDT', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSymbols.map((rowSym) => (
                <tr key={rowSym} className="hover:bg-slate-800/30">
                  <td className="p-1.5 border-r border-b border-slate-800 bg-slate-950 font-bold text-slate-300 flex items-center gap-1">
                    {leaders.includes(rowSym) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Leader" />
                    )}
                    {rowSym.replace('USDT', '')}
                  </td>
                  {filteredSymbols.map((colSym) => {
                    const val = rowSym === colSym ? 1.0 : (matrix[rowSym]?.[colSym] ?? 0);
                    return (
                      <td
                        key={colSym}
                        className={`p-1 text-center border-b border-slate-800/40 ${getHeatmapColor(val)}`}
                        title={`${rowSym} & ${colSym}: r = ${val.toFixed(3)}`}
                      >
                        {val === 1.0 ? '1.0' : val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
