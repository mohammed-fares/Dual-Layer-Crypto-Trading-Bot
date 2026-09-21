import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

// 4. Place Real Spot Market Order
app.post('/api/binance/order', async (req, res) => {
  try {
    const { apiKey, apiSecret, testnet, symbol, side, quoteOrderQty, quantity } = req.body || {};

    if (!symbol || !side) {
      return res.status(400).json({ success: false, error: 'رمز العملة symbol ونوع الأمر side مطلوبان.' });
    }

    const orderParams: Record<string, string | number> = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(), // 'BUY' or 'SELL'
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
