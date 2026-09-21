import React, { useState, useEffect } from 'react';
import { PriceAlert, CryptoAsset } from '../types';
import {
  Bell,
  BellRing,
  X,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Volume2,
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';

interface PriceAlertModalProps {
  asset: CryptoAsset;
  alerts: PriceAlert[];
  onAddAlert: (newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  onDeleteAlert: (id: string) => void;
  onClose: () => void;
  onTestNotification?: () => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  asset,
  alerts,
  onAddAlert,
  onDeleteAlert,
  onClose,
  onTestNotification,
}) => {
  const currentPrice = asset.price;
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [targetPriceStr, setTargetPriceStr] = useState<string>(
    (currentPrice * 1.02).toFixed(currentPrice < 1 ? 5 : 2)
  );
  const [note, setNote] = useState<string>('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync target price default when condition flips
  const handleConditionChange = (newCond: 'ABOVE' | 'BELOW') => {
    setCondition(newCond);
    const multiplier = newCond === 'ABOVE' ? 1.02 : 0.98;
    setTargetPriceStr((currentPrice * multiplier).toFixed(currentPrice < 1 ? 5 : 2));
  };

  // Quick percentage buttons
  const handleQuickPercent = (pct: number) => {
    const calculated = currentPrice * (1 + pct / 100);
    setTargetPriceStr(calculated.toFixed(currentPrice < 1 ? 5 : 2));
    if (pct > 0) setCondition('ABOVE');
    else setCondition('BELOW');
  };

  // Request browser permission
  const requestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('متصفحك لا يدعم إشعارات سطح المكتب (Desktop Notifications).');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        new Notification('🔔 تم تفعيل تنبيهات الأسعار بنجاح!', {
          body: `ستتلقى إشعاراً فورياً عند وصول ${asset.symbol} إلى السعر المستهدف.`,
          icon: '/favicon.ico',
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission', err);
    }
  };

  // Handle submit alert
  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPrice = parseFloat(targetPriceStr);
    if (isNaN(targetPrice) || targetPrice <= 0) return;

    onAddAlert({
      symbol: asset.symbol,
      targetPrice,
      condition,
      note: note.trim() || undefined,
    });

    setSuccessMessage(`تم إنشاء التنبيه بنجاح لـ ${asset.symbol} عند $${targetPrice}`);
    setTimeout(() => setSuccessMessage(null), 3500);
    setNote('');
  };

  const symbolAlerts = alerts.filter((a) => a.symbol === asset.symbol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                ضبط تنبيه سعري لـ {asset.symbol}
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {asset.sector}
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                <span>السعر الحالي:</span>
                <span className="text-white font-bold">
                  ${currentPrice < 1 ? currentPrice.toFixed(5) : currentPrice.toFixed(2)} USDT
                </span>
                <span
                  className={`font-semibold ${
                    asset.change1m >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ({asset.change1m >= 0 ? '+' : ''}
                  {asset.change1m.toFixed(2)}% 1m)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Browser Notification Permission Banner */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200 block">إشعارات المتصفح الفورية</span>
                <span className="text-[11px] text-slate-400">
                  {notificationPermission === 'granted'
                    ? 'مفعلة: ستتلقى نافذة منبثقة على سطح المكتب عند تحقق الشرط.'
                    : notificationPermission === 'denied'
                    ? 'تم حظر الإشعارات من إعدادات المتصفح. يمكنك إلغاء الحظر من شريط العنوان.'
                    : 'اضغط على تفعيل لتلقي تنبيه صوتي ومكتبي حتى لو كانت النافذة في الخلفية.'}
                </span>
              </div>
            </div>

            {notificationPermission === 'granted' ? (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-1 rounded-md border border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مفعلة
                </span>
                {onTestNotification && (
                  <button
                    type="button"
                    onClick={onTestNotification}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                    title="اختبار إرسال إشعار تجريبي الآن"
                  >
                    اختبار
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={requestBrowserPermission}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] rounded-lg shadow-md transition whitespace-nowrap"
              >
                تفعيل الإشعارات
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleCreateAlert} className="space-y-4">
            {/* Condition Selection */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                شرط إطلاق التنبيه السعري:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleConditionChange('ABOVE')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    condition === 'ABOVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>ارتفاع السعر فوق أو يساوي (≥)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConditionChange('BELOW')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    condition === 'BELOW'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span>انخفاض السعر تحت أو يساوي (≤)</span>
                </button>
              </div>
            </div>

            {/* Target Price & Quick Delta */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-300">السعر المستهدف (USDT):</label>
                <span className="text-[11px] text-slate-400 font-mono">
                  الفارق الحالي:{' '}
                  {targetPriceStr && !isNaN(parseFloat(targetPriceStr)) ? (
                    <span
                      className={
                        parseFloat(targetPriceStr) >= currentPrice
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      {(
                        ((parseFloat(targetPriceStr) - currentPrice) / currentPrice) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  ) : (
                    '0.00%'
                  )}
                </span>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  value={targetPriceStr}
                  onChange={(e) => setTargetPriceStr(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Quick Percent Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-500">اختصارات سريعة:</span>
                {[
                  { label: '+1%', val: 1 },
                  { label: '+2%', val: 2 },
                  { label: '+5%', val: 5 },
                  { label: '-1%', val: -1 },
                  { label: '-2%', val: -2 },
                  { label: '-5%', val: -5 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleQuickPercent(item.val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                      item.val > 0
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/60'
                        : 'bg-rose-950/40 text-rose-300 border-rose-800/40 hover:bg-rose-900/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                ملاحظة اختيارية (سبب التنبيه):
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: مراقبة اختراق مقاومة أو إشارة سنايبر لقائد القطاع"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-emerald-300 flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              تفعيل التنبيه السعري لـ {asset.symbol}
            </button>
          </form>

          {/* Active Alerts for this symbol */}
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <h3 className="font-semibold text-slate-300 flex items-center justify-between text-xs">
              <span>التنبيهات المضبوطة لـ {asset.symbol} ({symbolAlerts.length})</span>
              <span className="text-[11px] text-slate-500">تفحص كل تكة سعرية</span>
            </h3>

            {symbolAlerts.length === 0 ? (
              <div className="p-4 text-center bg-slate-950/40 border border-slate-800/40 rounded-xl text-slate-500 text-xs">
                لا توجد تنبيهات نشطة لهذه العملة حالياً.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {symbolAlerts.map((alt) => {
                  const isAbove = alt.condition === 'ABOVE';
                  return (
                    <div
                      key={alt.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                        alt.triggered
                          ? 'bg-amber-950/20 border-amber-600/40 text-amber-200'
                          : 'bg-slate-950/70 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isAbove
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isAbove ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 font-mono font-bold">
                            <span>
                              {isAbove ? 'إذا ارتفع فوق' : 'إذا انخفض تحت'} ${alt.targetPrice}
                            </span>
                            {alt.triggered && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                تم إطلاقه (${alt.triggeredPrice?.toFixed(alt.triggeredPrice < 1 ? 5 : 2)})
                              </span>
                            )}
                          </div>
                          {alt.note && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {alt.note}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-sans">
                            <Clock className="w-3 h-3" />
                            أُنشئ: {new Date(alt.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteAlert(alt.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                        title="حذف التنبيه"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            إجمالي التنبيهات الفعالة بالبوت:{' '}
            <span className="text-amber-400 font-bold font-mono">
              {alerts.filter((a) => !a.triggered).length}
            </span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
