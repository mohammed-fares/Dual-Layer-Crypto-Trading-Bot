import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'bot_state.json');
const REPORTS_DIR = path.join(process.cwd(), 'trading_reports');

// Ensure local persistence directories exist on Kali Linux / host filesystem
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Helper function to send signed requests to Binance Spot API (Mainnet or Testnet)
async function callBinanceSignedEndpoint(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  params: Record<string, string | number> = {},
  apiKey?: string,
  apiSecret?: string,
  useTestnet: boolean = false
) {
  const finalApiKey = apiKey || process.env.BINANCE_API_KEY;
  const finalApiSecret = apiSecret || process.env.BINANCE_API_SECRET;

  if (!finalApiKey || !finalApiSecret) {
    throw new Error('مفاتيح Binance API Key و API Secret مطلوبة لإجراء هذه العملية.');
  }

  const baseUrl = useTestnet
    ? 'https://testnet.binance.vision'
    : 'https://api.binance.com';

  const timestamp = Date.now();
  const queryObj = {
    ...params,
    timestamp,
    recvWindow: 5000,
  };

  const queryString = Object.entries(queryObj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const signature = crypto
    .createHmac('sha256', finalApiSecret)
    .update(queryString)
    .digest('hex');

  const finalUrl = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(finalUrl, {
    method,
    headers: {
      'X-MBX-APIKEY': finalApiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.msg || `Binance API Error: HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. Test Connection & Verify Account Permissions
app.post('/api/binance/test-connection', async (req, res) => {
  try {
    const { apiKey, apiSecret, testnet } = req.body || {};
    const accountData = await callBinanceSignedEndpoint(
      '/api/v3/account',
      'GET',
      {},
      apiKey,
      apiSecret,
      Boolean(testnet)
    );

    const usdt = (accountData.balances || []).find((b: any) => b.asset === 'USDT');
    const usdtBalance = usdt ? parseFloat(usdt.free) : 0.0;

    res.json({
      success: true,
      canTrade: Boolean(accountData.canTrade),
      canWithdraw: Boolean(accountData.canWithdraw),
      canDeposit: Boolean(accountData.canDeposit),
      accountType: accountData.accountType || 'SPOT',
      usdtBalance,
      balances: (accountData.balances || [])
        .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .slice(0, 10),
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'فشل الاتصال بمنصة Binance. تحقق من صحة المفاتيح وصلاحيات IP.',
    });
  }
});

// 3. Get Account Information & Free USDT Balance
app.post('/api/binance/account', async (req, res) => {
  try {
    const { apiKey, apiSecret, testnet } = req.body || {};
    const accountData = await callBinanceSignedEndpoint(
      '/api/v3/account',
      'GET',
      {},
      apiKey,
      apiSecret,
      Boolean(testnet)
    );

    const usdt = (accountData.balances || []).find((b: any) => b.asset === 'USDT');
    const usdtBalance = usdt ? parseFloat(usdt.free) : 0.0;

    res.json({
      success: true,
      canTrade: Boolean(accountData.canTrade),
      usdtBalance,
      balances: accountData.balances || [],
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'فشل قراءة بيانات الحساب من Binance',
    });
  }
});

// Recent order timestamps for anti-duplicate protection (5-second idempotency window)
const recentOrderTimestamps = new Map<string, number>();

// 4. Place Real Spot Market Order with Anti-Duplicate Idempotency Guard
app.post('/api/binance/order', async (req, res) => {
  try {
    const { apiKey, apiSecret, testnet, symbol, side, quoteOrderQty, quantity } = req.body || {};

    if (!symbol || !side) {
      return res.status(400).json({ success: false, error: 'رمز العملة symbol ونوع الأمر side مطلوبان.' });
    }

    const cleanSymbol = symbol.toUpperCase().trim();
    const cleanSide = side.toUpperCase().trim();
    const duplicateKey = `${cleanSymbol}_${cleanSide}`;
    const now = Date.now();
    const lastPlaced = recentOrderTimestamps.get(duplicateKey) || 0;

    // Strict Anti-Duplicate Guard: reject if identical order was received within 5 seconds
    if (now - lastPlaced < 5000) {
      const remainingSec = ((5000 - (now - lastPlaced)) / 1000).toFixed(1);
      return res.status(409).json({
        success: false,
        error: `[ANTI-DUPLICATE GUARD] تم منع تكرار الأمر لـ ${cleanSymbol} (${cleanSide}): تم إرسال أمر مماثل قبل قليل. يرجى الانتظار ${remainingSec} ثانية.`,
        isDuplicate: true,
      });
    }

    recentOrderTimestamps.set(duplicateKey, now);

    const orderParams: Record<string, string | number> = {
      symbol: cleanSymbol,
      side: cleanSide, // 'BUY' or 'SELL'
      type: 'MARKET',
    };

    if (quoteOrderQty) {
      orderParams.quoteOrderQty = parseFloat(quoteOrderQty).toFixed(2);
    } else if (quantity) {
      orderParams.quantity = parseFloat(quantity);
    } else {
      return res.status(400).json({ success: false, error: 'يجب تحديد quoteOrderQty أو quantity.' });
    }

    const orderResult = await callBinanceSignedEndpoint(
      '/api/v3/order',
      'POST',
      orderParams,
      apiKey,
      apiSecret,
      Boolean(testnet)
    );

    res.json({
      success: true,
      orderId: orderResult.orderId,
      symbol: orderResult.symbol,
      status: orderResult.status,
      executedQty: orderResult.executedQty,
      cummulativeQuoteQty: orderResult.cummulativeQuoteQty,
      fills: orderResult.fills || [],
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'فشل تنفيذ الأمر على منصة Binance.',
    });
  }
});

// 5. Bot State Persistence API: Get saved state from Kali Linux / host filesystem
app.get('/api/bot/state', (req, res) => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ exists: true, state: data });
    }
    return res.json({ exists: false });
  } catch (err: any) {
    return res.status(500).json({ exists: false, error: err.message });
  }
});

// 6. Bot State Persistence API: Save updated state to Kali Linux disk
app.post('/api/bot/state', (req, res) => {
  try {
    const stateData = req.body || {};
    let existing: Record<string, any> = {};
    if (fs.existsSync(STATE_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      } catch {}
    }
    const merged = { ...existing, ...stateData, updatedAt: Date.now() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return res.json({ success: true, updatedAt: merged.updatedAt });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Bot Clean Reset & Purge API: Wipe state and persist clean slate
app.post('/api/bot/reset', (req, res) => {
  try {
    const cleanState = {
      isPurged: true,
      walletBalance: 10000.0,
      positions: [],
      closedTrades: [],
      hourlyReports: [],
      cooldowns: {},
      tradingMode: 'PAPER',
      updatedAt: Date.now(),
      purgedAt: Date.now(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(cleanState, null, 2), 'utf-8');
    return res.json({ success: true, state: cleanState });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Save Hourly Report to trading_reports/ directory on disk
app.post('/api/bot/save-report', (req, res) => {
  try {
    const report = req.body;
    if (!report || !report.id) {
      return res.status(400).json({ success: false, error: 'Report data or id missing' });
    }

    const jsonPath = path.join(REPORTS_DIR, `report_${report.id}.json`);
    const txtPath = path.join(REPORTS_DIR, `report_${report.id}.txt`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    const sep = '='.repeat(78);
    const sub = '-'.repeat(78);
    const lines = [
      sep,
      `          HOURLY TRADING REPORT #${report.reportNumber} / تقرير التداول الدوري`,
      sep,
      `  • Report ID:           ${report.id}`,
      `  • Snapshot Time:       ${report.timeFormatted || new Date(report.timestamp).toLocaleTimeString()}`,
      `  • Period Covered:      ${report.periodStartFormatted} -> ${report.periodEndFormatted}`,
      sub,
      '  [1] PORTFOLIO & EQUITY OVERVIEW / ملخص المحفظة ورأس المال',
      sub,
      `  • Initial Capital:     $${Number(report.initialBalance || 10000).toFixed(2)} USDT`,
      `  • Available Cash:      $${Number(report.cashBalance || 0).toFixed(2)} USDT`,
      `  • Total Net Equity:    $${Number(report.totalEquity || 0).toFixed(2)} USDT`,
      `  • Peak Equity:         $${Number(report.peakEquity || 0).toFixed(2)} USDT`,
      `  • Drawdown:            ${Number(report.drawdownPct || 0).toFixed(2)}% (Max: ${Number(report.maxDrawdownPct || 0).toFixed(2)}%)`,
      `  • Total Net PnL:       ${report.totalPnlUsd >= 0 ? '+' : ''}$${Number(report.totalPnlUsd || 0).toFixed(2)} USDT (${report.totalPnlPct >= 0 ? '+' : ''}${Number(report.totalPnlPct || 0).toFixed(2)}%)`,
      sub,
      '  [2] HOURLY PERIOD DELTA / أداء هذه الساعة',
      sub,
      `  • Hour Net PnL:        ${report.hourPnlUsd >= 0 ? '+' : ''}$${Number(report.hourPnlUsd || 0).toFixed(2)} USDT (${report.hourPnlPct >= 0 ? '+' : ''}${Number(report.hourPnlPct || 0).toFixed(2)}%)`,
      `  • Hour Closed Trades:  ${report.hourTradesCount || 0} (Wins: ${report.hourWinningTrades || 0} | Losses: ${report.hourLosingTrades || 0})`,
      `  • Hour Win Rate:       ${Number(report.hourWinRatePct || 0).toFixed(1)}%`,
      `  • Cumulative Win Rate: ${Number(report.cumulativeWinRatePct || 0).toFixed(1)}% (Total Trades: ${report.cumulativeTradesCount || 0})`,
      sub,
      '  [3] MARKET REGIME & CONTEXT / بيئة السوق والشبكة',
      sub,
      `  • Market Regime:       ${report.marketRegime || 'BALANCED'}`,
      `  • Market Breadth:      ${Number(report.marketBreadth || 0).toFixed(2)}`,
      `  • Active Leaders:      ${Array.isArray(report.activeLeaders) ? report.activeLeaders.join(', ') : 'None'}`,
      `  • Open Positions:      ${report.openPositionsCount || 0}`,
      sub,
    ];

    if (Array.isArray(report.closedTradesThisHour) && report.closedTradesThisHour.length > 0) {
      lines.push('  [4] TRADES CLOSED IN THIS HOUR / الصفقات المنفذة خلال هذه الساعة');
      lines.push(sub);
      report.closedTradesThisHour.forEach((t: any) => {
        lines.push(
          `    - ${String(t.symbol || '').padEnd(10)} | Exit: $${Number(t.exitPrice || 0).toFixed(4)} | PnL: ${t.pnlUsd >= 0 ? '+' : ''}$${Number(t.pnlUsd || 0).toFixed(2)} (${t.returnPct >= 0 ? '+' : ''}${Number(t.returnPct || 0).toFixed(2)}%) | Reason: ${t.reason || 'EXIT'}`
        );
      });
      lines.push(sub);
    }
    lines.push(sep);

    fs.writeFileSync(txtPath, lines.join('\n'), 'utf-8');

    return res.json({ success: true, jsonPath, txtPath });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Read all saved reports from disk
app.get('/api/bot/reports', (req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      return res.json({ reports: [] });
    }
    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.json'));
    const reports = files
      .map((file) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    reports.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
    return res.json({ reports });
  } catch (err: any) {
    return res.status(500).json({ reports: [], error: err.message });
  }
});

// Setup Vite middleware for development or serve dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DUAL-BOT SERVER] Running on port ${PORT}`);
  });
}

startServer();
