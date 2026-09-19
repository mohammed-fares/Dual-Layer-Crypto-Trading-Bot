import React from 'react';
import { Position, ClosedTrade } from '../types';
import { Wallet, TrendingUp, TrendingDown, Clock, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  balance: number;
  initialBalance: number;
  positions: Position[];
  closedTrades: ClosedTrade[];
  cooldowns: Record<string, number>; // symbol -> expiry timestamp (ms)
  onClosePositionManually?: (symbol: string) => void;
  onResetWallet?: () => void;
}

export const PaperWalletView: React.FC<Props> = ({
  balance,
  initialBalance,
  positions,
  closedTrades,
  cooldowns,
  onClosePositionManually,
  onResetWallet,
}) => {
  const totalPnlUsd = balance - initialBalance;
  const totalPnlPct = (totalPnlUsd / initialBalance) * 100;
  const wins = closedTrades.filter((t) => t.returnPct > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  const now = Date.now();
  const activeCooldowns = Object.entries(cooldowns).filter(([_, expiry]) => expiry > now);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5">
      {/* Top Wallet Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Virtual Paper Wallet (محفظة التداول الوهمية)
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Live In-Memory Engine
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Allocates 500 USDT (5% portfolio) per sniper trade. TP at +2.5%, SL at -1.2%, 15m Cooldown.
            </p>
          </div>
        </div>

        {onResetWallet && (
          <button
            onClick={onResetWallet}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Reset Wallet (10,000 USDT)
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Current Balance */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Current Balance</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-slate-100">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 ml-1">USDT</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Initial: ${initialBalance.toLocaleString()} USDT</span>
        </div>

        {/* Total Net PnL */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Net Realized PnL</span>
          <div className="mt-1 flex items-center gap-1.5">
            {totalPnlUsd >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
            <span
              className={`text-xl font-bold font-mono ${
                totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalPnlUsd >= 0 ? '+' : ''}
              {totalPnlUsd.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">USDT</span>
          </div>
          <span
            className={`text-[11px] font-mono font-semibold ${
              totalPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalPnlPct >= 0 ? '+' : ''}
            {totalPnlPct.toFixed(2)}% ROI
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Win Rate</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-indigo-400">{winRate.toFixed(1)}%</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {wins} Won / {closedTrades.length - wins} Lost ({closedTrades.length} Total)
          </span>
        </div>

        {/* Active Positions & Cooldowns */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Active Status</span>
          <div className="mt-1 flex items-center gap-3">
            <div>
              <span className="text-lg font-bold font-mono text-cyan-400">{positions.length}</span>
              <span className="text-[11px] text-slate-500 ml-1">Open</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-lg font-bold font-mono text-amber-400">{activeCooldowns.length}</span>
              <span className="text-[11px] text-slate-500 ml-1">Cooling</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Max Position: 500 USDT (5%)</span>
        </div>
      </div>

      {/* Active Positions Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          Active Simulated Positions ({positions.length})
        </h3>

        {positions.length === 0 ? (
          <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-lg text-xs text-slate-400 text-center">
            No active trades. The Sniper Layer is actively scanning Binance WebSocket feeds for Leader breakouts (&gt;1.5%) to snipe lagging followers.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positions.map((pos) => {
              const priceDiff = pos.currentPrice - pos.entryPrice;
              const pnlPct = (priceDiff / pos.entryPrice) * 100;
              const pnlUsd = (pos.sizeUsd * pnlPct) / 100;
              const isProfit = pnlPct >= 0;

              // TP target is +2.5%, SL target is -1.2%
              // Calculate progress normalized from -1.2% (0%) to +2.5% (100%)
              const range = 2.5 - (-1.2);
              const progress = Math.min(Math.max(((pnlPct - (-1.2)) / range) * 100, 0), 100);

              return (
                <div
                  key={pos.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-100">{pos.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-semibold">
                        SNIPED FOLLOWER
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {pnlPct.toFixed(2)}% ({pnlUsd >= 0 ? '+' : ''}${pnlUsd.toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Trigger information */}
                  <div className="text-[11px] text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800/80 flex items-center justify-between">
                    <span>
                      Trigger Leader: <strong className="text-indigo-400">{pos.triggerLeader}</strong>
                    </span>
                    <span>
                      Correlation: <strong className="font-mono text-cyan-400">r={pos.correlation.toFixed(2)}</strong>
                    </span>
                  </div>

                  {/* Price Tracker & TP/SL visual */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>SL: ${pos.stopLossPrice.toFixed(pos.stopLossPrice < 1 ? 5 : 2)} (-1.2%)</span>
                      <span className="text-slate-200 font-bold">
                        Entry: ${pos.entryPrice.toFixed(pos.entryPrice < 1 ? 5 : 2)}
                      </span>
                      <span>TP: ${pos.takeProfitPrice.toFixed(pos.takeProfitPrice < 1 ? 5 : 2)} (+2.5%)</span>
                    </div>

                    {/* TP/SL Progress Bar */}
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isProfit ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Stop Loss Boundary</span>
                      <span className="font-mono text-slate-300">
                        Current: ${pos.currentPrice.toFixed(pos.currentPrice < 1 ? 5 : 2)}
                      </span>
                      <span>Take Profit Target</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {onClosePositionManually && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => onClosePositionManually(pos.symbol)}
                        className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                      >
                        Close Position (Manual Test)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Cooldowns Bar */}
      {activeCooldowns.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-2">
            <Clock className="w-4 h-4" />
            Active 15-Minute Cooldowns ({activeCooldowns.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {activeCooldowns.map(([sym, expiry]) => {
              const secondsLeft = Math.max(Math.round((expiry - now) / 1000), 0);
              const minutes = Math.floor(secondsLeft / 60);
              const seconds = secondsLeft % 60;
              return (
                <div
                  key={sym}
                  className="px-2.5 py-1 bg-slate-900 border border-amber-700/50 rounded text-xs font-mono flex items-center gap-2"
                >
                  <span className="text-slate-200 font-bold">{sym.replace('USDT', '')}</span>
                  <span className="text-amber-400">
                    {minutes}m {seconds < 10 ? '0' : ''}
                    {seconds}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closed Trades History with Arabic/English Report format */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Closed Trade Records / سجل الصفقات المغلقة ({closedTrades.length})</span>
          <span className="text-[11px] text-slate-500 font-normal">Auto TP / SL Executions</span>
        </h3>

        {closedTrades.length === 0 ? (
          <div className="p-3 bg-slate-950/40 rounded text-xs text-slate-500 text-center">
            No closed trades recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {closedTrades.slice(-8).reverse().map((t) => {
              const isProfit = t.returnPct >= 0;
              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border text-xs font-mono flex flex-col gap-1.5 transition ${
                    isProfit
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-rose-950/20 border-rose-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      {isProfit ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>{t.symbol}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({t.reason === 'TAKE_PROFIT' ? '🎯 Take Profit +2.5%' : t.reason === 'STOP_LOSS' ? '🛑 Stop Loss -1.2%' : 'Manual'})
                      </span>
                    </div>
                    <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfit ? '+' : ''}
                      {t.returnPct.toFixed(2)}% ({t.pnlUsd >= 0 ? '+' : ''}${t.pnlUsd.toFixed(2)})
                    </span>
                  </div>

                  {/* Formatted prompt line: [اسم العملة | سعر الدخول | سعر الخروج | النتيجة % | الرصيد الحالي للمحفظة الوهمية] */}
                  <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2 rounded border border-slate-800/60 leading-relaxed font-sans">
                    <strong>[ اسم العملة: {t.symbol} | </strong>
                    <span>سعر الدخول: ${t.entryPrice.toFixed(t.entryPrice < 1 ? 5 : 2)} | </span>
                    <span>سعر الخروج: ${t.exitPrice.toFixed(t.exitPrice < 1 ? 5 : 2)} | </span>
                    <span className={isProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      النتيجة: {t.returnPct >= 0 ? '+' : ''}{t.returnPct.toFixed(2)}% |{' '}
                    </span>
                    <strong className="text-indigo-300">
                      الرصيد الحالي: ${t.walletBalanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT ]
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
