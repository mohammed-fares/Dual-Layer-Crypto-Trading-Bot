import React from 'react';
import { Position, ClosedTrade, TradingMode, LiveTradingConfig } from '../types';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Settings,
  ShieldCheck,
  Zap,
  PowerOff
} from 'lucide-react';

interface Props {
  mode: TradingMode;
  onToggleMode: (mode: TradingMode) => void;
  onOpenLiveConfig: () => void;
  liveConfig: LiveTradingConfig;
  balance: number;
  initialBalance: number;
  positions: Position[];
  closedTrades: ClosedTrade[];
  cooldowns: Record<string, number>; // symbol -> expiry timestamp (ms)
  onClosePositionManually?: (symbol: string) => void;
  onResetWallet?: () => void;
  onKillSwitch?: () => void;
}

export const PaperWalletView: React.FC<Props> = ({
  mode,
  onToggleMode,
  onOpenLiveConfig,
  liveConfig,
  balance,
  initialBalance,
  positions,
  closedTrades,
  cooldowns,
  onClosePositionManually,
  onResetWallet,
  onKillSwitch,
}) => {
  const isLive = mode === 'LIVE';
  const effectiveBalance = isLive ? (liveConfig.liveUsdtBalance || balance) : balance;
  const totalPnlUsd = effectiveBalance - initialBalance;
  const totalPnlPct = initialBalance > 0 ? (totalPnlUsd / initialBalance) * 100 : 0;
  const wins = closedTrades.filter((t) => t.returnPct > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  const now = Date.now();
  const activeCooldowns = Object.entries(cooldowns).filter(([_, expiry]) => expiry > now);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5">
      {/* Mode Switcher Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-400 font-semibold">نظام تشغيل البوت:</span>
          <div className="flex items-center p-1 bg-slate-900 border border-slate-700/80 rounded-lg">
            <button
              onClick={() => onToggleMode('PAPER')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${
                !isLive
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              تداول تجريبي (Paper 10K USDT)
            </button>
            <button
              onClick={() => onToggleMode('LIVE')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5 ${
                isLive
                  ? 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-900/50 animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              تداول حقيقي (Live Binance Account)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenLiveConfig}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            {liveConfig.isConnected ? 'إعدادات Binance API (متصل)' : 'ربط حساب Binance API'}
          </button>

          {isLive && onKillSwitch && (
            <button
              onClick={onKillSwitch}
              className="text-xs px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-600 flex items-center gap-1.5 transition font-bold"
              title="إيقاف فوري لجميع عمليات التداول الحقيقي والعودة للوضع التجريبي"
            >
              <PowerOff className="w-3.5 h-3.5 text-rose-400" />
              قاطع الطوارئ (Kill Switch)
            </button>
          )}
        </div>
      </div>

      {/* Live Warning Banner if in Live Mode */}
      {isLive && (
        <div className="bg-rose-950/60 border-2 border-rose-600/80 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-rose-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 rounded-lg text-white animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                🔴 وضع التداول الحقيقي نشط على حسابك الفعلي (LIVE ACCOUNT ACTIVE)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {liveConfig.useTestnet ? 'Binance Testnet' : 'Binance Mainnet'}
                </span>
              </div>
              <p className="text-rose-200/90 text-xs mt-0.5">
                يتم إرسال أوامر الشراء والبيع الفورية (Spot Orders) مباشرة إلى محفظة Binance الحقيقية بحد أقصى{' '}
                <span className="font-bold text-white">{liveConfig.maxOrderSizeUsd} USDT</span> لكل صفقة سنايبر.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[11px] text-rose-300">الرصيد الفعلي المتاح:</div>
            <div className="text-base font-mono font-bold text-white">
              ${liveConfig.liveUsdtBalance.toFixed(2)} USDT
            </div>
          </div>
        </div>
      )}

      {/* Top Wallet Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isLive
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              {isLive ? 'Live Binance Spot Wallet (محفظة بينانس الحقيقية)' : 'Virtual Paper Wallet (محفظة التداول الافتراضية)'}
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                  isLive
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {isLive ? 'Real Spot Execution' : 'Paper In-Memory Engine'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isLive
                ? `حجم الصفقة محدد بـ ${liveConfig.maxOrderSizeUsd} USDT مع جني أرباح +2.5% ووقف خسارة -1.2%.`
                : 'يخصص 500 USDT (5% من المحفظة) لكل صفقة سنايبر. أهداف +2.5% ربح و -1.2% وقف خسارة و 15 دقيقة تهدئة.'}
            </p>
          </div>
        </div>

        {!isLive && onResetWallet && (
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
          <span className="text-xs text-slate-400 font-medium">
            {isLive ? 'رصيد USDT الفعلي' : 'Current Balance'}
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-slate-100">
              ${effectiveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 ml-1">USDT</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {isLive ? 'محدث مباشرة من Binance' : `Initial: $${initialBalance.toLocaleString()} USDT`}
          </span>
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
          <span className="text-xs text-slate-400 font-medium">Win Rate / Completed</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-indigo-400">
              {winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 ml-2 font-mono">
              ({wins}W - {closedTrades.length - wins}L)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">{closedTrades.length} Trades Total</span>
        </div>

        {/* Active Positions */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Open Positions</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold font-mono text-amber-400">
              {positions.length}
            </span>
            <span className="text-xs text-slate-500">/ 5 Max</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {activeCooldowns.length} in Cooldown (15m)
          </span>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Active Open Sniper Positions ({positions.length})</span>
          <span className="text-[11px] text-slate-500 lowercase">evaluated every live tick</span>
        </h3>

        {positions.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 border border-slate-800/60 rounded-xl text-slate-500 text-xs flex flex-col items-center gap-2">
            <Clock className="w-6 h-6 text-slate-600" />
            <span>لا توجد صفقات مفتوحة حالياً. نظام السنايبر يراقب العملات القيادية للفرص المؤهلة.</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800/80 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Asset</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Live Price</th>
                  <th className="py-2.5 px-3">Position Size</th>
                  <th className="py-2.5 px-3">Target TP (+2.5%)</th>
                  <th className="py-2.5 px-3">Stop Loss (-1.2%)</th>
                  <th className="py-2.5 px-3">PnL</th>
                  <th className="py-2.5 px-3">Trigger Leader</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {positions.map((pos) => {
                  const pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                  const pnlUsd = pos.coinsAmount * (pos.currentPrice - pos.entryPrice);
                  const isProfitable = pnlPct >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">
                        {pos.symbol}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        ${pos.entryPrice < 1 ? pos.entryPrice.toFixed(6) : pos.entryPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-100">
                        ${pos.currentPrice < 1 ? pos.currentPrice.toFixed(6) : pos.currentPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        ${pos.sizeUsd.toFixed(0)} USDT
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        ${pos.takeProfitPrice < 1 ? pos.takeProfitPrice.toFixed(6) : pos.takeProfitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400">
                        ${pos.stopLossPrice < 1 ? pos.stopLossPrice.toFixed(6) : pos.stopLossPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span className={isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                          {isProfitable ? '+' : ''}{pnlPct.toFixed(2)}% (${pnlUsd.toFixed(2)})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-indigo-400 font-sans text-[11px]">
                        {pos.triggerLeader} (r={pos.correlation.toFixed(2)})
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {onClosePositionManually && (
                          <button
                            onClick={() => onClosePositionManually(pos.symbol)}
                            className="px-2 py-1 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 rounded text-[11px] transition border border-slate-700"
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Trades History */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Closed Trades History ({closedTrades.length})
        </h3>

        {closedTrades.length === 0 ? (
          <div className="p-4 text-center bg-slate-950/40 border border-slate-800/40 rounded-lg text-slate-500 text-xs">
            لا توجد صفقات مغلقة بعد.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800/80 rounded-lg max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] sticky top-0">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Entry</th>
                  <th className="py-2 px-3">Exit</th>
                  <th className="py-2 px-3">PnL %</th>
                  <th className="py-2 px-3">PnL $</th>
                  <th className="py-2 px-3">Exit Reason</th>
                  <th className="py-2 px-3">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {closedTrades
                  .slice()
                  .reverse()
                  .map((trade) => {
                    const isWin = trade.returnPct > 0;
                    return (
                      <tr key={trade.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-500 text-[11px] font-sans">
                          {new Date(trade.exitTime).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-200">
                          {trade.symbol}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          ${trade.entryPrice < 1 ? trade.entryPrice.toFixed(6) : trade.entryPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          ${trade.exitPrice < 1 ? trade.exitPrice.toFixed(6) : trade.exitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                            {isWin ? '+' : ''}{trade.returnPct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                            {isWin ? '+' : ''}${trade.pnlUsd.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans text-[11px]">
                          {trade.reason === 'TAKE_PROFIT' ? (
                            <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                              TP (+2.5%)
                            </span>
                          ) : trade.reason === 'STOP_LOSS' ? (
                            <span className="text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/50">
                              SL (-1.2%)
                            </span>
                          ) : (
                            <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                              MANUAL
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          ${trade.walletBalanceAfter.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active 15m Cooldowns Bar */}
      {activeCooldowns.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-300">Active Post-Exit 15m Cooldowns:</span>
            <span>(Prevents immediate re-entry churn on volatile assets)</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {activeCooldowns.map(([sym, expiry]) => {
              const remainingSec = Math.max(0, Math.floor((expiry - now) / 1000));
              const m = Math.floor(remainingSec / 60);
              const s = remainingSec % 60;
              return (
                <span
                  key={sym}
                  className="px-2 py-1 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 font-mono text-[11px]"
                >
                  {sym}: {m}m {s}s remaining
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
