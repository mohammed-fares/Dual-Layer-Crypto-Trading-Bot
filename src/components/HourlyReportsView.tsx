import React, { useState } from 'react';
import { HourlyTradingReport } from '../types';
import {
  Clock,
  Download,
  FileText,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  FileCode,
  Eye,
  X,
  Copy,
  Check,
  Zap,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface HourlyReportsViewProps {
  reports: HourlyTradingReport[];
  onGenerateReportNow: () => void;
  nextReportSeconds: number;
}

export const HourlyReportsView: React.FC<HourlyReportsViewProps> = ({
  reports,
  onGenerateReportNow,
  nextReportSeconds,
}) => {
  const [selectedReport, setSelectedReport] = useState<HourlyTradingReport | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Format countdown mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Generate ASCII / TXT format for a report
  const generateTextReport = (r: HourlyTradingReport) => {
    const sep = '='.repeat(78);
    const sub = '-'.repeat(78);
    const title = r.isSessionFinal
      ? 'SESSION FINAL REPORT / تقرير ختام الجلسة'
      : `HOURLY TRADING REPORT #${r.reportNumber} / تقرير التداول الدوري (كل ساعة)`;

    const lines = [
      sep,
      `          ${title}`,
      sep,
      `  • Report ID:           ${r.id}`,
      `  • Snapshot Time:       ${r.timeFormatted}`,
      `  • Period Covered:      ${r.periodStartFormatted} -> ${r.periodEndFormatted}`,
      sub,
      '  [1] PORTFOLIO & EQUITY OVERVIEW / ملخص المحفظة ورأس المال',
      sub,
      `  • Initial Capital:     $${r.initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT`,
      `  • Available Cash:      $${r.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT`,
      `  • Total Net Equity:    $${r.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT`,
      `  • Peak Equity:         $${r.peakEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT`,
      `  • Current Drawdown:    ${r.drawdownPct.toFixed(2)}% (Max: ${r.maxDrawdownPct.toFixed(2)}%)`,
      `  • Total Net PnL:       ${r.totalPnlUsd >= 0 ? '+' : ''}$${r.totalPnlUsd.toFixed(2)} USDT (${r.totalPnlPct >= 0 ? '+' : ''}${r.totalPnlPct.toFixed(2)}%)`,
      sub,
      '  [2] HOURLY PERIOD DELTA / أداء هذه الساعة',
      sub,
      `  • Hour Net PnL:        ${r.hourPnlUsd >= 0 ? '+' : ''}$${r.hourPnlUsd.toFixed(2)} USDT (${r.hourPnlPct >= 0 ? '+' : ''}${r.hourPnlPct.toFixed(2)}%)`,
      `  • Hour Closed Trades:  ${r.hourTradesCount} (Wins: ${r.hourWinningTrades} | Losses: ${r.hourLosingTrades})`,
      `  • Hour Win Rate:       ${r.hourWinRatePct.toFixed(1)}%`,
      `  • Cumulative Win Rate: ${r.cumulativeWinRatePct.toFixed(1)}% (Total Trades: ${r.cumulativeTradesCount})`,
      sub,
      '  [3] MARKET REGIME & CONTEXT / بيئة السوق والشبكة',
      sub,
      `  • Market Regime:       ${r.marketRegime}`,
      `  • Market Breadth:      ${r.marketBreadth >= 0 ? '+' : ''}${r.marketBreadth.toFixed(2)}`,
      `  • Active Leaders:      ${r.activeLeaders.join(', ') || 'None'}`,
      `  • Open Positions:      ${r.openPositionsCount}`,
      sub,
    ];

    if (r.closedTradesThisHour.length > 0) {
      lines.push('  [4] TRADES CLOSED IN THIS HOUR / الصفقات المنفذة خلال هذه الساعة');
      lines.push(sub);
      r.closedTradesThisHour.forEach((t) => {
        lines.push(
          `    - ${t.symbol.padEnd(10)} | Exit: $${t.exitPrice.toFixed(4)} | PnL: ${t.pnlUsd >= 0 ? '+' : ''}$${t.pnlUsd.toFixed(2)} (${t.returnPct >= 0 ? '+' : ''}${t.returnPct.toFixed(2)}%) | Reason: ${t.reason}`
        );
      });
      lines.push(sub);
    }

    lines.push(sep);
    return lines.join('\n');
  };

  const handleDownloadJson = (r: HourlyTradingReport) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${r.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = (r: HourlyTradingReport) => {
    const text = generateTextReport(r);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${r.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAllJson = () => {
    const blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_hourly_reports_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {}
  };

  const totalHourTrades = reports.reduce((acc, r) => acc + r.hourTradesCount, 0);
  const bestHour = reports.reduce(
    (max, r) => (r.hourPnlUsd > max.hourPnlUsd ? r : max),
    reports[0] || { hourPnlUsd: 0, hourPnlPct: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  محرك حفظ تقارير التداول كل ساعة (Hourly Trading Reports Engine)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  حفظ تلقائي كل 60 دقيقة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                توليد وتخزين تقارير دورية شاملة بصيغة JSON و TXT في مجلد <code className="text-cyan-300 font-mono">trading_reports/</code> مع حساب أرباح كل ساعة ونسب النجاح والصفقات المفتوحة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Countdown pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-500">التقرير التالي خلال:</span>
              <span className="text-cyan-300 font-bold">{formatCountdown(nextReportSeconds)}</span>
            </div>

            <button
              onClick={onGenerateReportNow}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              title="توليد تقرير الساعة يدوياً وحفظه فوراً"
            >
              <Zap className="w-3.5 h-3.5" />
              حفظ تقرير الساعة الآن
            </button>

            {reports.length > 0 && (
              <button
                onClick={handleExportAllJson}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition"
                title="تصدير جميع التقارير كملف JSON موحد"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير الكل (.JSON)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>إجمالي التقارير المسجلة</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {reports.length} <span className="text-xs font-normal text-slate-500">ساعة</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">تغطية زمنية مستمرة</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>أرباح آخر ساعة مسجلة</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          {reports.length > 0 ? (
            <>
              <div
                className={`text-xl font-bold font-mono ${
                  reports[reports.length - 1].hourPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {reports[reports.length - 1].hourPnlUsd >= 0 ? '+' : ''}$
                {reports[reports.length - 1].hourPnlUsd.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {reports[reports.length - 1].hourPnlPct >= 0 ? '+' : ''}
                {reports[reports.length - 1].hourPnlPct.toFixed(2)}% في الساعة
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">بانتظار أول تقرير...</div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>أعلى ساعة أرباحاً (Best Hour)</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          {reports.length > 0 && bestHour ? (
            <>
              <div className="text-xl font-bold font-mono text-emerald-400">
                +${bestHour.hourPnlUsd.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                {bestHour.hourPnlPct >= 0 ? '+' : ''}{bestHour.hourPnlPct.toFixed(2)}% ({bestHour.timeFormatted})
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">--</div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>إجمالي صفقات الساعات</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {totalHourTrades} <span className="text-xs font-normal text-slate-500">صفقة</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            موزعة على {reports.length} تقرير ساعة
          </div>
        </div>
      </div>

      {/* Reports History List / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">سجل تقارير الساعات المحفوظة (Hourly Snapshots)</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {reports.length} تقارير
            </span>
          </div>
          <span className="text-xs text-slate-400">
            الملفات تُحفظ تلقائياً في المسار: <code className="text-indigo-300 font-mono">trading_reports/*.json</code>
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">لم يتم حفظ أي تقارير بعد.</p>
            <p className="text-xs text-slate-600">
              اضغط على "حفظ تقرير الساعة الآن" لإنشاء أول تقرير دوري فوري.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {reports
              .slice()
              .reverse()
              .map((rep) => {
                const isProfitable = rep.hourPnlUsd >= 0;
                return (
                  <div
                    key={rep.id}
                    className="p-4 hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left details */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-2 rounded-lg text-xs font-mono font-bold mt-0.5 ${
                          isProfitable
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        #{rep.reportNumber.toString().padStart(2, '0')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200">
                            تقرير الساعة {rep.reportNumber}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            ({rep.periodStartFormatted} - {rep.periodEndFormatted})
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {rep.marketRegime}
                          </span>
                          {rep.isSessionFinal && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              تقرير ختام الجلسة
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-mono">
                          <div>
                            رأس المال:{' '}
                            <span className="text-slate-200 font-semibold">
                              ${rep.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            أرباح الساعة:{' '}
                            <span
                              className={`font-semibold ${
                                isProfitable ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isProfitable ? '+' : ''}${rep.hourPnlUsd.toFixed(2)} ({isProfitable ? '+' : ''}
                              {rep.hourPnlPct.toFixed(2)}%)
                            </span>
                          </div>
                          <div>
                            صفقات الساعة:{' '}
                            <span className="text-slate-200">
                              {rep.hourTradesCount} (فوز: {rep.hourWinningTrades} | خسارة: {rep.hourLosingTrades})
                            </span>
                          </div>
                          <div>
                            نسبة النجاح:{' '}
                            <span className="text-cyan-400">{rep.hourWinRatePct.toFixed(1)}%</span>
                          </div>
                          <div>
                            صفقات مفتوحة:{' '}
                            <span className="text-amber-400">{rep.openPositionsCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => setSelectedReport(rep)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        عرض التفاصيل
                      </button>

                      <button
                        onClick={() => handleDownloadJson(rep)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700/80 transition"
                        title="تحميل كملف JSON"
                      >
                        <FileCode className="w-3.5 h-3.5 text-amber-400" />
                        JSON
                      </button>

                      <button
                        onClick={() => handleDownloadTxt(rep)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700/80 transition"
                        title="تحميل كملف نصي منسق TXT"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        TXT
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Modal Detail View */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    تقرير التداول الدوري #{selectedReport.reportNumber}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedReport.id} &bull; الفترة: {selectedReport.periodStartFormatted} إلى {selectedReport.periodEndFormatted}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">قيمة المحفظة</span>
                <span className="text-white font-bold text-sm">
                  ${selectedReport.totalEquity.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">صافي أرباح الساعة</span>
                <span
                  className={`font-bold text-sm ${
                    selectedReport.hourPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedReport.hourPnlUsd >= 0 ? '+' : ''}${selectedReport.hourPnlUsd.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">نسبة نجاح الساعة</span>
                <span className="text-cyan-400 font-bold text-sm">
                  {selectedReport.hourWinRatePct.toFixed(1)}%
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">أقصى تراجع للمحفظة</span>
                <span className="text-amber-400 font-bold text-sm">
                  {selectedReport.maxDrawdownPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Closed Trades in this hour */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                الصفقات المغلقة خلال هذه الساعة ({selectedReport.closedTradesThisHour.length})
              </h4>
              {selectedReport.closedTradesThisHour.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-950 p-3 rounded border border-slate-800">
                  لم يتم إغلاق أي صفقات خلال هذه الساعة المحددة.
                </div>
              ) : (
                <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden text-xs">
                  <table className="w-full text-right font-mono">
                    <thead className="bg-slate-900/80 text-slate-400 text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">الزوج</th>
                        <th className="p-2.5">الدخول</th>
                        <th className="p-2.5">الخروج</th>
                        <th className="p-2.5">الربح/الخسارة</th>
                        <th className="p-2.5">النسبة</th>
                        <th className="p-2.5">السبب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedReport.closedTradesThisHour.map((tr) => (
                        <tr key={tr.id} className="hover:bg-slate-800/30">
                          <td className="p-2.5 font-bold text-white">{tr.symbol}</td>
                          <td className="p-2.5 text-slate-300">${tr.entryPrice.toFixed(4)}</td>
                          <td className="p-2.5 text-slate-300">${tr.exitPrice.toFixed(4)}</td>
                          <td
                            className={`p-2.5 font-bold ${
                              tr.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tr.pnlUsd >= 0 ? '+' : ''}${tr.pnlUsd.toFixed(2)}
                          </td>
                          <td
                            className={`p-2.5 ${
                              tr.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tr.returnPct >= 0 ? '+' : ''}{tr.returnPct.toFixed(2)}%
                          </td>
                          <td className="p-2.5 text-slate-400 text-[10px]">{tr.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Formatted Text Box */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>معاينة التقرير النصي المحفوظ على القرص (.TXT)</span>
                <button
                  onClick={() => handleCopyText(generateTextReport(selectedReport))}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700"
                >
                  {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedText ? 'تم النسخ!' : 'نسخ التقرير'}
                </button>
              </div>

              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400/90 max-h-56 overflow-y-auto leading-relaxed select-text">
                {generateTextReport(selectedReport)}
              </pre>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleDownloadJson(selectedReport)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                تحميل JSON
              </button>

              <button
                onClick={() => handleDownloadTxt(selectedReport)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                <Download className="w-3.5 h-3.5" />
                تحميل تقرير TXT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
