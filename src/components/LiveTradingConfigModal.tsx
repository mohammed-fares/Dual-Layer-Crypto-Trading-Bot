import React, { useState } from 'react';
import { LiveTradingConfig } from '../types';
import { ShieldCheck, ShieldAlert, Key, Zap, CheckCircle2, AlertTriangle, X, ExternalLink, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: LiveTradingConfig;
  onSaveConfig: (updated: LiveTradingConfig) => void;
  onSwitchToLive: () => void;
}

export const LiveTradingConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onSwitchToLive,
}) => {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [apiSecret, setApiSecret] = useState(config.apiSecret);
  const [useTestnet, setUseTestnet] = useState(config.useTestnet);
  const [maxOrderSizeUsd, setMaxOrderSizeUsd] = useState(config.maxOrderSizeUsd || 50);
  const [dailyStopLossPct, setDailyStopLossPct] = useState(config.dailyStopLossPct || 3.0);

  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    usdtBalance?: number;
    canTrade?: boolean;
    accountType?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setTestResult({
        success: false,
        message: 'يرجى إدخال كل من API Key و API Secret قبل بدء الفحص.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/binance/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          testnet: useTestnet,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `تم الاتصال بنجاح بـ Binance (${useTestnet ? 'Testnet' : 'Mainnet'}). صلاحيات التداول Spot مفعلة!`,
          usdtBalance: data.usdtBalance,
          canTrade: data.canTrade,
          accountType: data.accountType,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'فشل الاتصال بمنصة Binance. تحقق من صحة المفاتيح وتقييدات الـ IP.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'تعذر الوصول إلى خادم البوت للتحقق من Binance.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndActivate = () => {
    const updated: LiveTradingConfig = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      useTestnet,
      maxOrderSizeUsd: Number(maxOrderSizeUsd) || 50,
      dailyStopLossPct: Number(dailyStopLossPct) || 3.0,
      isConnected: testResult ? testResult.success : config.isConnected,
      canTrade: testResult?.canTrade ?? config.canTrade,
      liveUsdtBalance: testResult?.usdtBalance ?? config.liveUsdtBalance,
      lastConnectedAt: Date.now(),
    };

    onSaveConfig(updated);
    if (updated.apiKey && updated.apiSecret) {
      onSwitchToLive();
    }
    onClose();
  };

  const handleClearKeys = () => {
    setApiKey('');
    setApiSecret('');
    setTestResult(null);
    onSaveConfig({
      apiKey: '',
      apiSecret: '',
      useTestnet: false,
      maxOrderSizeUsd: 50,
      dailyStopLossPct: 3.0,
      isConnected: false,
      canTrade: false,
      liveUsdtBalance: 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl p-6 flex flex-col gap-5 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                إعدادات التداول على الحساب الحقيقي (Binance Live Account)
              </h3>
              <p className="text-xs text-slate-400">
                ربط مفاتيح API لتنفيذ صفقات التداول الفعلية على حسابك الشخصي في Binance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning Box */}
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 leading-relaxed">
            <strong className="text-rose-300 font-semibold">
              تعليمات أمان حاسمة لحماية أموالك (Critical Security Guardrails):
            </strong>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-300/90">
              <li>
                فعّل <strong>فقط خيار Spot Trading (Enable Spot & Margin Trading)</strong> عند إنشاء مفتاح API في بايننس.
              </li>
              <li>
                <strong className="text-white underline">ممنوع منعاً باتاً</strong> تفعيل خيار السحب <strong>(Do NOT Enable Withdrawals)</strong>.
              </li>
              <li>
                المفاتيح تُحفظ مشفرة محلياً وتُستخدم فقط لتوقيع أوامر الشراء والبيع الفورية (Spot Orders).
              </li>
            </ul>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="flex flex-col gap-4 text-xs">
          {/* Environment Choice */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-300 font-medium">بيئة التداول (Target Network):</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUseTestnet(false)}
                className={`p-3 rounded-xl border flex items-center justify-between text-left transition ${
                  !useTestnet
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">Binance Mainnet (حساب حقيقي فعلي)</div>
                  <div className="text-[10px] text-slate-400">api.binance.com - أموال حقيقية</div>
                </div>
                {!useTestnet && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setUseTestnet(true)}
                className={`p-3 rounded-xl border flex items-center justify-between text-left transition ${
                  useTestnet
                    ? 'bg-indigo-500/10 border-indigo-500/60 text-indigo-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">Binance Spot Testnet (بيئة الاختبار)</div>
                  <div className="text-[10px] text-slate-400">testnet.binance.vision - أموال تجريبية</div>
                </div>
                {useTestnet && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-300 font-medium flex items-center justify-between">
              <span>Binance API Key:</span>
              <a
                href="https://www.binance.com/en/my/settings/api-management"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                إدارة المفاتيح في بايننس <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="e.g. vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utI Utilities..."
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-200 font-mono focus:border-amber-500 outline-none w-full"
            />
          </div>

          {/* API Secret */}
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-300 font-medium">Binance Secret Key (HMAC-SHA256):</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="e.g. 5xX401bV1oI22sV1s..."
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-xs text-slate-200 font-mono focus:border-amber-500 outline-none w-full"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Risk Limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-slate-300 font-medium">
                الحد الأقصى لحجم الصفقة الحقيقية (Max Order USDT):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={maxOrderSizeUsd}
                  onChange={(e) => setMaxOrderSizeUsd(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-500 outline-none w-full"
                />
                <span className="text-xs text-slate-400">USDT</span>
              </div>
              <span className="text-[10px] text-slate-500">حماية من المخاطر: ننصح بـ 25-50 USDT في البداية</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-300 font-medium">
                وقف الخسارة اليومي التلقائي (Daily Stop Drawdown):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={dailyStopLossPct}
                  onChange={(e) => setDailyStopLossPct(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-500 outline-none w-full"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
              <span className="text-[10px] text-slate-500">يتوقف البوت فوراً إذا انخفض الرصيد اليومي بهذه النسبة</span>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
              {isTesting ? 'جاري فحص الاتصال وقراءة الرصيد...' : 'فحص الاتصال والتحقق من رصيد Binance الآن (Test Ping & Balances)'}
            </button>

            {testResult && (
              <div
                className={`mt-2.5 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-700/60 text-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-0.5">
                  <div className="font-semibold">{testResult.message}</div>
                  {testResult.success && testResult.usdtBalance !== undefined && (
                    <div className="font-mono text-emerald-300 font-bold mt-1">
                      الرصيد الفعلي المتاح: {testResult.usdtBalance.toFixed(2)} USDT (نوع الحساب: {testResult.accountType || 'SPOT'})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-1">
          <button
            type="button"
            onClick={handleClearKeys}
            className="text-xs px-3 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
          >
            مسح المفاتيح وفصل الاتصال
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveAndActivate}
              disabled={!apiKey.trim() || !apiSecret.trim()}
              className="text-xs px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-amber-900/30"
            >
              <Zap className="w-4 h-4 fill-current" />
              حفظ وتفعيل وضع التداول الحقيقي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
