import React, { useState } from 'react';
import { PYTHON_SCRIPT_CODE } from '../pythonCode';
import { Download, Copy, Check, Terminal, FileCode, ExternalLink, ShieldCheck } from 'lucide-react';

export const PythonCodeViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [copiedBash, setCopiedBash] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(PYTHON_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([PYTHON_SCRIPT_CODE], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'crypto_dual_layer_bot.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [guideTab, setGuideTab] = useState<'kali' | 'vps' | 'reset'>('kali');
  const [copiedVps, setCopiedVps] = useState(false);

  const kaliBashCommands = `# ================================================================
# دليل تشغيل البوت على نظام كالي لينكس (Kali Linux Execution Guide)
# ================================================================

# 1. تحديث مستودعات النظام وتثبيت بيئة بايثون وأدوات البناء
sudo apt update && sudo apt install -y python3 python3-pip python3-venv tmux curl

# 2. إنشاء مجلد العمل للبوت
mkdir -p ~/binance_dual_bot && cd ~/binance_dual_bot

# 3. وضع كود البوت (قم بنسخ أو تحميل crypto_dual_layer_bot.py إلى هذا المجلد)

# 4. إنشاء وتفعيل بيئة بايثون الافتراضية المعزولة (Virtual Environment)
python3 -m venv venv
source venv/bin/activate

# 5. تثبيت حزم التحليل الكمي والاتصال المباشر بمنصة بينانس
pip install --upgrade pip
pip install websockets pandas numpy scipy aiohttp

# 6. التشغيل القياسي للبوت مع حفظ تقارير التداول كل ساعة تلقائياً:
# (يتم حفظ ملفات JSON وتقارير TXT المقروءة في مجلد trading_reports/)
python3 crypto_dual_layer_bot.py

# 7. أو التشغيل مع تهيئة نظيفة وتطهير كامل للذاكرة والسجلات:
python3 crypto_dual_layer_bot.py --reset --clean-reports

# 8. للتشغيل في الخلفية بصورة دائمة عبر tmux (حتى لو أغلقت التيرمينال):
tmux new -s trading_bot
python3 crypto_dual_layer_bot.py
# (للخروج مع إبقاء البوت يعمل: اضغط Ctrl+B ثم اضغط D)
# (للعودة لشاشة البوت في أي وقت: tmux attach -t trading_bot)`;

  const vpsServiceCommands = `# ====================================================================
# دليل نشر وتشغيل البوت على خوادم الاستضافة السحابية (VPS Cloud 24/7)
# (يدعم Ubuntu 22.04 / 24.04 / Debian 11/12 / Hetzner / DigitalOcean / AWS)
# ====================================================================

# 1. تحديث السيرفر وتثبيت المتطلبات:
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git curl

# 2. إعداد مجلد البوت والبيئة الافتراضية:
sudo mkdir -p /opt/crypto_bot
sudo chown -R $USER:$USER /opt/crypto_bot
cd /opt/crypto_bot

python3 -m venv venv
source venv/bin/activate
pip install websockets pandas numpy scipy aiohttp

# 3. إنشاء خدمة نظام دائم (systemd Service) لضمان العمل 24/7 وإعادة التشغيل الآلي:
sudo bash -c 'cat > /etc/systemd/system/crypto-bot.service << "EOF"
[Unit]
Description=Dual-Layer Crypto Trading Bot Service
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/crypto_bot
ExecStart=/opt/crypto_bot/venv/bin/python3 /opt/crypto_bot/crypto_dual_layer_bot.py --report-interval 3600
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF'

# 4. تفعيل وتشغيل الخدمة تلقائياً عند إقلاع السيرفر:
sudo systemctl daemon-reload
sudo systemctl enable crypto-bot
sudo systemctl start crypto-bot

# 5. مراقبة سجلات التداول الحية لحظة بلحظة:
sudo journalctl -u crypto-bot -f

# 6. للتحقق من التقارير الساعية المحفوظة:
ls -lh /opt/crypto_bot/trading_reports/`;

  const resetGuideCommands = `# ====================================================================
# أوامر التهيئة النظيفة وإعادة تعيين البوت (Clean Reset & Purge)
# ====================================================================

# 1. إعادة تعيين البوت وتطهير الذاكرة والمحفظة إلى 10,000 USDT وجلب أسعار بينانس الحية:
python3 crypto_dual_layer_bot.py --reset

# 2. إعادة تعيين وتطهير تقارير الساعات السابقة أيضاً للبدء من الصفر تماماً:
python3 crypto_dual_layer_bot.py --reset --clean-reports

# 3. تشغيل فحص واختبار كمي سريع على البيانات الحقيقية:
python3 crypto_dual_layer_bot.py --test --duration 15

# 4. تشغيل محاكاة كمية لمدة 60 دقيقة ومقارنتها بمؤشرات المقارنة الأربعة (Baselines):
python3 crypto_dual_layer_bot.py --backtest --duration 60`;

  const handleCopyBash = async (text: string, type: 'kali' | 'vps' | 'reset') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'kali') {
        setCopiedBash(true);
        setTimeout(() => setCopiedBash(false), 2000);
      } else if (type === 'vps') {
        setCopiedVps(true);
        setTimeout(() => setCopiedVps(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5">
      {/* Header and Download Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Standalone Python 3 Script (crypto_dual_layer_bot.py)
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                100% Complete &amp; Closed
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Single-file asynchronous Python bot with Dual-Layer Architecture, ready for direct execution on Kali Linux.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Code!' : 'Copy Python Code'}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download crypto_dual_layer_bot.py
          </button>
        </div>
      </div>

      {/* Deployment & Execution Guide Section */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGuideTab('kali')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                guideTab === 'kali'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              1. تشغيل على Kali Linux
            </button>
            <button
              onClick={() => setGuideTab('vps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                guideTab === 'vps'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              2. رفع على الاستضافة السحابية (VPS 24/7)
            </button>
            <button
              onClick={() => setGuideTab('reset')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                guideTab === 'reset'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              3. أوامر التهيئة النظيفة والاختبار
            </button>
          </div>

          <button
            onClick={() => {
              if (guideTab === 'kali') handleCopyBash(kaliBashCommands, 'kali');
              else if (guideTab === 'vps') handleCopyBash(vpsServiceCommands, 'vps');
              else handleCopyBash(resetGuideCommands, 'reset');
            }}
            className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 transition"
          >
            {(guideTab === 'kali' && copiedBash) || (guideTab === 'vps' && copiedVps) ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>نسخ أوامر {guideTab === 'kali' ? 'كالي لينكس' : guideTab === 'vps' ? 'الاستضافة' : 'التهيئة'}</span>
          </button>
        </div>

        <pre className="bg-slate-950 p-3.5 rounded border border-slate-800/80 text-[11px] font-mono text-emerald-400/90 overflow-x-auto leading-relaxed max-h-[280px]">
          {guideTab === 'kali' && kaliBashCommands}
          {guideTab === 'vps' && vpsServiceCommands}
          {guideTab === 'reset' && resetGuideCommands}
        </pre>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Binance API keys needed (Public streams)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Automated hourly report engine armed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>100% Real Live Binance Tick Data</span>
          </div>
        </div>
      </div>

      {/* Full Code Display with Syntax Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">crypto_dual_layer_bot.py ({PYTHON_SCRIPT_CODE.split('\n').length} lines)</span>
          <span>Target Architecture: Dual-Layer (Context Graph + Sniper WebSockets)</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-[500px] overflow-y-auto p-4 font-mono text-[11px] text-slate-300 leading-relaxed select-text">
          <pre>{PYTHON_SCRIPT_CODE}</pre>
        </div>
      </div>
    </div>
  );
};
