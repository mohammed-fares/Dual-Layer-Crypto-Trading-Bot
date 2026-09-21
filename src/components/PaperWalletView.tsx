import React from 'react';
import { Position, ClosedTrade, TradingMode, LiveTradingConfig, HourlyTradingReport } from '../types';
import { EquityGrowthChart } from './EquityGrowthChart';
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
  PowerOff,
  Coins,
  Layers,
  Lock,
  Percent,
  Sliders,
  Activity,
  BarChart3
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
  hourlyReports?: HourlyTradingReport[];
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
  hourlyReports = [],
  onClosePositionManually,
  onResetWallet,
  onKillSwitch,
}) => {
  const isLive = mode === 'LIVE';
  const cashBalance = isLive ? (liveConfig.liveUsdtBalance || balance) : balance;

  // Quantitative Portfolio & Risk Engine Calculations
  const totalAllocatedMargin = positions.reduce((acc, p) => acc + p.sizeUsd, 0);
  const totalPositionMarketValue = positions.reduce((acc, p) => acc + p.coinsAmount * p.currentPrice, 0);
  const totalUnrealizedPnlUsd = totalPositionMarketValue - totalAllocatedMargin;
  const totalNetEquity = cashBalance + totalPositionMarketValue;

  const totalRealizedPnlUsd = closedTrades.reduce((acc, t) => acc + t.pnlUsd, 0);
  const totalNetPnlUsd = totalNetEquity - initialBalance;
  const totalNetPnlPct = initialBalance > 0 ? (totalNetPnlUsd / initialBalance) * 100 : 0;

  const wins = closedTrades.filter((t) => t.returnPct > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  const now = Date.now();
  const activeCooldowns = Object.entries(cooldowns).filter(([_, expiry]) => expiry > now);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-6" id="paper-wallet-container">
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
                ? `حجم الصفقة محدد بـ ${liveConfig.maxOrderSizeUsd} USDT مع جني أرباح +1.6% ووقف خسارة -1.0%.`
                : 'تخصيص 500 USDT (5% من رأس المال) لكل صفقة سنايبر مع أهداف +1.6% جني أرباح و -1.0% وقف خسارة و 15 دقيقة تهدئة.'}
            </p>
          </div>
        </div>

        {!isLive && onResetWallet && (
          <button
            onClick={onResetWallet}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>Reset Wallet (10,000 USDT)</span>
          </button>
        )}
      </div>

      {/* KPI Cards Ribbon (Accurately Audited Accounting) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Net Equity (NAV) */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-cyan-400" />
            Total Net Equity (NAV)
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-slate-100">
              ${totalNetEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 ml-1">USDT</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            كاش ({cashBalance.toFixed(0)}) + صفقات ({totalPositionMarketValue.toFixed(0)})
          </span>
        </div>

        {/* Liquid Cash Balance */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Available Cash (USDT)</span>
          <div className="mt-1">
            <span className="text-xl font-bold font-mono text-slate-200">
              ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 ml-1">USDT</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {totalAllocatedMargin > 0 ? `$${totalAllocatedMargin.toFixed(0)} مستثمر في صفقات` : 'جاهز للاقتناص الفوري'}
          </span>
        </div>

        {/* Total Net PnL (Realized + Unrealized) */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Total Net PnL (ROI)</span>
          <div className="mt-1 flex items-center gap-1.5">
            {totalNetPnlUsd >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
            <span
              className={`text-xl font-bold font-mono ${
                totalNetPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalNetPnlUsd >= 0 ? '+' : ''}
              {totalNetPnlUsd.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">USDT</span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span
              className={`font-mono font-semibold ${
                totalNetPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalNetPnlPct >= 0 ? '+' : ''}
              {totalNetPnlPct.toFixed(2)}% ROI
            </span>
            <span className="text-slate-500 text-[10px]">
              محقق: ${totalRealizedPnlUsd.toFixed(1)}
            </span>
          </div>
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
          <span className="text-[11px] text-slate-500 mt-1">{closedTrades.length} صفقات مغلقة</span>
        </div>

        {/* Active Positions */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Open Positions</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold font-mono text-amber-400">
              {positions.length}
            </span>
            <span className="text-xs text-slate-500">/ 3 Max Concurrent</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            {activeCooldowns.length} عملات في فترة تهدئة (15m)
          </span>
        </div>
      </div>

      {/* NEW D3 VISUALIZATION: Total Equity Growth Over Time */}
      <EquityGrowthChart
        reports={hourlyReports}
        currentEquity={totalNetEquity}
        initialBalance={initialBalance}
      />

      {/* Risk Engine & Parameter Audit Panel */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
          <span className="font-semibold text-slate-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            معايير محرك إدارة المخاطر وتخصيص رأس المال (Risk Engine Audit &amp; Exposure Rules)
          </span>
          <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">
            VERIFIED ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 text-[11px] block">حد الصفقات المتزامنة (Max Concurrent):</span>
            <span className="font-mono font-bold text-slate-100 text-sm">3 صفقات كحد أقصى</span>
            <span className="text-slate-500 text-[10px] block mt-0.5">حد أقصى للتعرض 1,500 USDT (15%)</span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 text-[11px] block">حجم الصفقة الواحدة (Position Sizing):</span>
            <span className="font-mono font-bold text-slate-100 text-sm">500 USDT (5% رأس المال)</span>
            <span className="text-slate-500 text-[10px] block mt-0.5">تثبيت المخاطرة لكل صفقة سنايبر</span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 text-[11px] block">أهداف الربح ووقف الخسارة (TP &amp; SL):</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">TP: +1.6% | SL: -1.0%</span>
            <span className="text-slate-500 text-[10px] block mt-0.5">نسبة المخاطرة إلى العائد 1.6 : 1.0</span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
            <span className="text-slate-400 text-[11px] block">فترة التهدئة الإلزامية (Cooldown):</span>
            <span className="font-mono font-bold text-amber-300 text-sm">15 دقيقة (900 ثانية)</span>
            <span className="text-slate-500 text-[10px] block mt-0.5">حماية من تقلبات السوق المتتالية</span>
          </div>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            Active Open Sniper Positions ({positions.length})
          </span>
          <span className="text-[11px] text-slate-500 lowercase">تقييم مستمر مع كل تكة سعرية مباشرة</span>
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
                  <th className="py-2.5 px-3">Target TP (+1.6%)</th>
                  <th className="py-2.5 px-3">Stop Loss (-1.0%)</th>
                  <th className="py-2.5 px-3">Unrealized PnL</th>
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
                              TP (+1.6%)
                            </span>
                          ) : trade.reason === 'STOP_LOSS' ? (
                            <span className="text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/50">
                              SL (-1.0%)
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
            <span>(حماية صارمة من التكرار والارتدادات السريعة)</span>
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
