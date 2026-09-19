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

  const kaliBashCommands = `# 1. Update and install Python environment tools on Kali Linux
sudo apt update && sudo apt install -y python3 python3-pip python3-venv

# 2. Create project directory
mkdir -p ~/binance_dual_bot && cd ~/binance_dual_bot

# 3. Create and activate isolated virtual environment
python3 -m venv venv
source venv/bin/activate

# 4. Install required analytical and async packages
pip install websockets pandas numpy aiohttp

# 5. Place crypto_dual_layer_bot.py in the folder and execute:
python3 crypto_dual_layer_bot.py`;

  const handleCopyBash = async () => {
    try {
      await navigator.clipboard.writeText(kaliBashCommands);
      setCopiedBash(true);
      setTimeout(() => setCopiedBash(false), 2000);
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

      {/* Kali Linux Setup Guide Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Kali Linux Execution Guide (أوامر التشغيل على كالي لينكس)
          </div>
          <button
            onClick={handleCopyBash}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800"
          >
            {copiedBash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedBash ? 'Copied commands' : 'Copy bash script'}
          </button>
        </div>

        <pre className="bg-slate-950 p-3 rounded border border-slate-800/80 text-[11px] font-mono text-emerald-400/90 overflow-x-auto leading-relaxed">
          {kaliBashCommands}
        </pre>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Binance API keys needed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pure Asyncio &amp; WebSockets</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Safe In-Memory Paper Wallet</span>
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
