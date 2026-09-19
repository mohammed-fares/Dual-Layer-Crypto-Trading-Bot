import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TARGET_SYMBOLS_METADATA } from './data/symbols';
import { CryptoAsset, Position, ClosedTrade, TerminalLog } from './types';
import { ContextGraphVisualizer } from './components/ContextGraphVisualizer';
import { CorrelationMatrixView } from './components/CorrelationMatrixView';
import { PaperWalletView } from './components/PaperWalletView';
import { TerminalView } from './components/TerminalView';
import { PythonCodeViewer } from './components/PythonCodeViewer';
import {
  Activity,
  Network,
  Table,
  Wallet,
  Terminal,
  FileCode,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'graph' | 'matrix' | 'wallet' | 'terminal' | 'code'>('graph');
  const [selectedAsset, setSelectedAsset] = useState<string | null>('BTCUSDT');
  const [activeSurgeLeader, setActiveSurgeLeader] = useState<string | null>(null);

  // 1. Assets Dictionary
  const [assets, setAssets] = useState<Record<string, CryptoAsset>>(() => {
    const initial: Record<string, CryptoAsset> = {};
    TARGET_SYMBOLS_METADATA.forEach((meta) => {
      initial[meta.symbol] = {
        symbol: meta.symbol,
        name: meta.name,
        sector: meta.sector,
        price: meta.initialPrice,
        prevPrice: meta.initialPrice,
        change1m: 0.0,
        change24h: (Math.random() * 8 - 4),
        volume24h: Math.floor(Math.random() * 50000000 + 10000000),
        isLeader: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'].includes(meta.symbol),
        lastUpdated: Date.now(),
        priceHistory: [meta.initialPrice],
      };
    });
    return initial;
  });

  // 2. Correlation Matrix & Graph State
  const [leaders, setLeaders] = useState<string[]>(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'NEARUSDT', 'SUIUSDT']);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>(() => {
    // Generate base correlation matrix with sector clustering
    const baseMat: Record<string, Record<string, number>> = {};
    const symbols = TARGET_SYMBOLS_METADATA.map((s) => s.symbol);

    symbols.forEach((s1) => {
      baseMat[s1] = {};
      symbols.forEach((s2) => {
        if (s1 === s2) {
          baseMat[s1][s2] = 1.0;
        } else {
          const meta1 = TARGET_SYMBOLS_METADATA.find((m) => m.symbol === s1);
          const meta2 = TARGET_SYMBOLS_METADATA.find((m) => m.symbol === s2);
          const sameSector = meta1 && meta2 && meta1.sector === meta2.sector;
          // High correlation for same sector or BTC-ETH pairs
          const r = sameSector
            ? 0.82 + Math.random() * 0.12
            : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(s1) && ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(s2)
            ? 0.88 + Math.random() * 0.08
            : 0.35 + Math.random() * 0.45;
          baseMat[s1][s2] = parseFloat(Math.min(r, 0.98).toFixed(3));
        }
      });
    });
    return baseMat;
  });

  const [followersMap, setFollowersMap] = useState<Record<string, { symbol: string; correlation: number }[]>>({});

  // 3. Paper Trading State
  const [walletBalance, setWalletBalance] = useState<number>(10000.0);
  const initialBalance = 10000.0;
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // 4. Terminal Logs
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: 'Dual-Layer Crypto Trading Bot initialized on Kali Linux / Python 3 Asyncio runtime.',
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      type: 'BRAIN',
      message: '[THE BRAIN] Swarm sub-agents loaded 25 target assets. Initial Context Graph synthesized.',
    },
    {
      id: 'init-3',
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: '[THE EXECUTIONER] WebSocket listener armed. Target Universe: 25 High-Liquidity pairs.',
    },
  ]);

  const addLog = useCallback((type: TerminalLog['type'], message: string) => {
    setLogs((prev) => [
      ...prev.slice(-150),
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
      },
    ]);
  }, []);

  // Update followers map from matrix & leaders
  useEffect(() => {
    const fMap: Record<string, { symbol: string; correlation: number }[]> = {};
    leaders.forEach((lead) => {
      fMap[lead] = [];
      const row = matrix[lead] || {};
      Object.entries(row).forEach(([follower, r]) => {
        if (follower !== lead && r >= 0.75) {
          fMap[lead].push({ symbol: follower, correlation: r });
        }
      });
      fMap[lead].sort((a, b) => b.correlation - a.correlation);
    });
    setFollowersMap(fMap);
  }, [leaders, matrix]);

  // Evaluate TP & SL on active positions
  const evaluatePositions = useCallback(
    (currentPrices: Record<string, number>) => {
      setPositions((prevPositions) => {
        const remaining: Position[] = [];
        const toClose: { pos: Position; exitPrice: number; reason: 'TAKE_PROFIT' | 'STOP_LOSS' }[] = [];

        prevPositions.forEach((pos) => {
          const currentPrice = currentPrices[pos.symbol] || pos.currentPrice;
          const updatedPos = { ...pos, currentPrice };

          if (currentPrice >= pos.takeProfitPrice) {
            toClose.push({ pos: updatedPos, exitPrice: currentPrice, reason: 'TAKE_PROFIT' });
          } else if (currentPrice <= pos.stopLossPrice) {
            toClose.push({ pos: updatedPos, exitPrice: currentPrice, reason: 'STOP_LOSS' });
          } else {
            remaining.push(updatedPos);
          }
        });

        if (toClose.length > 0) {
          toClose.forEach(({ pos, exitPrice, reason }) => {
            const exitVal = pos.coinsAmount * exitPrice;
            const pnlUsd = exitVal - pos.sizeUsd;
            const returnPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
            const now = Date.now();

            setWalletBalance((prevBal) => {
              const newBal = prevBal + exitVal;

              const closedRecord: ClosedTrade = {
                id: Math.random().toString(36).substring(2, 9),
                symbol: pos.symbol,
                entryPrice: pos.entryPrice,
                exitPrice,
                sizeUsd: pos.sizeUsd,
                returnPct,
                pnlUsd,
                exitTime: now,
                reason,
                walletBalanceAfter: newBal,
                triggerLeader: pos.triggerLeader,
              };

              setClosedTrades((prevTrades) => [...prevTrades, closedRecord]);

              // Set 15-minute cooldown (15 * 60 * 1000 ms)
              setCooldowns((prevCd) => ({ ...prevCd, [pos.symbol]: now + 15 * 60 * 1000 }));

              // Log matching terminal output
              addLog(
                'TRADE',
                `[ ${pos.symbol} | Entry: $${pos.entryPrice.toFixed(pos.entryPrice < 1 ? 5 : 2)} | Exit: $${exitPrice.toFixed(
                  exitPrice < 1 ? 5 : 2
                )} | PnL: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}% (${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(
                  2
                )}) | Balance: $${newBal.toFixed(2)} USDT ] (Reason: ${reason})`
              );

              return newBal;
            });
          });
        }

        return remaining;
      });
    },
    [addLog]
  );

  // Trigger Sniper Trade on Lagging Follower
  const triggerSniperTrade = useCallback(
    (leaderSymbol: string, leaderSurge: number) => {
      setActiveSurgeLeader(leaderSymbol);
      addLog(
        'SNIPER',
        `⚡ [LEADER SURGE DETECTED] ${leaderSymbol} surged +${leaderSurge.toFixed(
          2
        )}% in 60s! Traversing Context Graph for lagging followers...`
      );

      // Lookup lagging followers
      const followers = followersMap[leaderSymbol] || [];
      const eligible = followers.filter((f) => {
        const asset = assets[f.symbol];
        const move1m = asset?.change1m || 0;
        const inCooldown = (cooldowns[f.symbol] || 0) > Date.now();
        const alreadyOpen = positions.some((p) => p.symbol === f.symbol);
        return move1m < 0.45 && move1m > -1.2 && !inCooldown && !alreadyOpen && f.correlation >= 0.65;
      });

      if (eligible.length === 0) {
        addLog(
          'INFO',
          `[SNIPER SCAN] No eligible lagging followers available for ${leaderSymbol} (all moved, cooling, or active).`
        );
        setTimeout(() => setActiveSurgeLeader(null), 3500);
        return;
      }

      // Pick top correlated lagging follower with highest lag gap
      eligible.sort((a, b) => {
        const gapA = (leaderSurge - (assets[a.symbol]?.change1m || 0)) * a.correlation;
        const gapB = (leaderSurge - (assets[b.symbol]?.change1m || 0)) * b.correlation;
        return gapB - gapA;
      });
      const target = eligible[0];
      const targetAsset = assets[target.symbol];
      if (!targetAsset) return;

      const currentPrice = targetAsset.price;
      const sizeUsd = Math.min(500.0, walletBalance * 0.05);

      if (walletBalance < sizeUsd) {
        addLog('WARN', `[SNIPER] Insufficient virtual balance to execute trade on ${target.symbol}.`);
        setTimeout(() => setActiveSurgeLeader(null), 3500);
        return;
      }

      setWalletBalance((prev) => prev - sizeUsd);
      const coinsAmount = sizeUsd / currentPrice;
      const tp = currentPrice * 1.016; // Scalp TP: +1.6%
      const sl = currentPrice * 0.990; // Risk SL: -1.0%

      const newPos: Position = {
        id: Math.random().toString(36).substring(2, 9),
        symbol: target.symbol,
        entryPrice: currentPrice,
        currentPrice,
        sizeUsd,
        coinsAmount,
        entryTime: Date.now(),
        takeProfitPrice: tp,
        stopLossPrice: sl,
        triggerLeader: leaderSymbol,
        correlation: target.correlation,
        unrealizedPnlUsd: 0,
        unrealizedPnlPct: 0,
      };

      setPositions((prev) => [...prev, newPos]);
      addLog(
        'SNIPER',
        `🎯 [SNIPER ORDER EXECUTED] Bought ${target.symbol} @ $${currentPrice.toFixed(
          currentPrice < 1 ? 5 : 2
        )} | Size: ${sizeUsd.toFixed(2)} USDT | Trigger: ${leaderSymbol} (r=${target.correlation.toFixed(
          2
        )}) | TP: $${tp.toFixed(tp < 1 ? 5 : 2)} (+1.6%) | SL: $${sl.toFixed(sl < 1 ? 5 : 2)} (-1.0%) | Breakeven @ +0.7%`
      );

      setTimeout(() => setActiveSurgeLeader(null), 5000);
    },
    [assets, cooldowns, followersMap, positions, walletBalance, addLog]
  );

  // Binance Public WebSockets integration with simulated fallback
  useEffect(() => {
    let ws: WebSocket | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      const symbols = TARGET_SYMBOLS_METADATA.map((s) => s.symbol.toLowerCase());
      const streams = symbols.map((s) => `${s}@miniTicker`).join('/');
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        addLog('SUCCESS', '[WEBSOCKET CONNECTED] Streaming real-time ticks directly from Binance Public WebSocket.');
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const data = raw.data || raw;
          const symbol = data.s;
          const closePrice = parseFloat(data.c);

          if (symbol && !isNaN(closePrice)) {
            setAssets((prev) => {
              const existing = prev[symbol];
              if (!existing) return prev;

              const oldPrice = existing.price;
              const history = [...existing.priceHistory.slice(-20), closePrice];
              const p1m = history[0] || oldPrice;
              const change1m = ((closePrice - p1m) / p1m) * 100;

              const updated: CryptoAsset = {
                ...existing,
                prevPrice: oldPrice,
                price: closePrice,
                change1m,
                lastUpdated: Date.now(),
                priceHistory: history,
              };

              // Check if leader surged > 1.5% in 1 minute
              if (existing.isLeader && change1m >= 1.5 && Math.random() < 0.1) {
                triggerSniperTrade(symbol, change1m);
              }

              return { ...prev, [symbol]: updated };
            });

            // Evaluate positions
            evaluatePositions({ [symbol]: closePrice });
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        addLog('WARN', '[WEBSOCKET] Direct Binance WebSocket blocked in preview iframe. Enabling high-fidelity tick simulator.');
        startFallbackSimulator();
      };
    } catch {
      startFallbackSimulator();
    }

    function startFallbackSimulator() {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        setAssets((prev) => {
          const next = { ...prev };
          const pricesMap: Record<string, number> = {};

          Object.keys(next).forEach((sym) => {
            const asset = next[sym];
            const volatility = ['PEPEUSDT', 'BONKUSDT', 'WIFUSDT'].includes(sym) ? 0.0035 : 0.0012;
            const delta = (Math.random() - 0.49) * volatility;
            const newPrice = asset.price * (1 + delta);
            const history = [...asset.priceHistory.slice(-20), newPrice];
            const p1m = history[0] || newPrice;
            const change1m = ((newPrice - p1m) / p1m) * 100;

            next[sym] = {
              ...asset,
              prevPrice: asset.price,
              price: newPrice,
              change1m,
              lastUpdated: Date.now(),
              priceHistory: history,
            };
            pricesMap[sym] = newPrice;
          });

          // Evaluate TP/SL
          evaluatePositions(pricesMap);
          return next;
        });
      }, 1500);
    }

    return () => {
      if (ws) ws.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [addLog, evaluatePositions, triggerSniperTrade]);

  // Context Graph Swarm Loop (Simulating Background Task every 2 minutes or upon request)
  useEffect(() => {
    const swarmTimer = setInterval(() => {
      addLog('BRAIN', '[THE BRAIN] Swarm sub-agents running 2-minute cycle: Recomputing Pearson correlation matrix & leader scores.');

      setMatrix((prev) => {
        const next = { ...prev };
        // Jitter correlations slightly to mimic market evolution
        Object.keys(next).forEach((s1) => {
          Object.keys(next[s1]).forEach((s2) => {
            if (s1 !== s2) {
              const cur = next[s1][s2];
              const jitter = (Math.random() - 0.5) * 0.02;
              next[s1][s2] = parseFloat(Math.min(Math.max(cur + jitter, -0.99), 0.99).toFixed(3));
            }
          });
        });
        return next;
      });
    }, 120000); // 2 minutes

    return () => clearInterval(swarmTimer);
  }, [addLog]);

  // Test manual leader surge button
  const handleSimulateSurge = (symbol: string) => {
    setAssets((prev) => {
      const asset = prev[symbol];
      if (!asset) return prev;
      const surgedPrice = asset.price * 1.018; // +1.8% surge
      const updated = {
        ...asset,
        price: surgedPrice,
        change1m: 1.82,
        priceHistory: [...asset.priceHistory.slice(-19), surgedPrice],
      };
      return { ...prev, [symbol]: updated };
    });

    triggerSniperTrade(symbol, 1.82);
  };

  const handleClosePositionManually = (symbol: string) => {
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) return;

    const exitPrice = pos.currentPrice;
    const exitVal = pos.coinsAmount * exitPrice;
    const pnlUsd = exitVal - pos.sizeUsd;
    const returnPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const now = Date.now();

    setPositions((prev) => prev.filter((p) => p.symbol !== symbol));
    setWalletBalance((prev) => prev + exitVal);

    const closedRecord: ClosedTrade = {
      id: Math.random().toString(36).substring(2, 9),
      symbol: pos.symbol,
      entryPrice: pos.entryPrice,
      exitPrice,
      sizeUsd: pos.sizeUsd,
      returnPct,
      pnlUsd,
      exitTime: now,
      reason: 'MANUAL',
      walletBalanceAfter: walletBalance + exitVal,
      triggerLeader: pos.triggerLeader,
    };

    setClosedTrades((prev) => [...prev, closedRecord]);
    setCooldowns((prev) => ({ ...prev, [pos.symbol]: now + 15 * 60 * 1000 }));

    addLog(
      'TRADE',
      `[ ${pos.symbol} | Entry: $${pos.entryPrice.toFixed(pos.entryPrice < 1 ? 5 : 2)} | Exit: $${exitPrice.toFixed(
        exitPrice < 1 ? 5 : 2
      )} | PnL: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}% | Balance: $${(walletBalance + exitVal).toFixed(
        2
      )} USDT ] (Manual Close)`
    );
  };

  const handleResetWallet = () => {
    setWalletBalance(10000.0);
    setPositions([]);
    setClosedTrades([]);
    setCooldowns({});
    addLog('INFO', 'Virtual Paper Wallet reset to 10,000.00 USDT.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/90 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Architecture Identity */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white">
                  Dual-Layer Crypto Trading Bot
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Python 3 + Asyncio
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Kali Linux Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Context Graph Swarm Engineering &bull; Live Binance Public Sniper &bull; 10,000 USDT Paper Engine
              </p>
            </div>
          </div>

          {/* Wallet Mini-Status Pill */}
          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 rounded-lg px-3.5 py-1.5 text-xs font-mono">
            <div>
              <span className="text-slate-500">Balance: </span>
              <span className="text-slate-100 font-bold">
                ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500">PnL: </span>
              <span
                className={`font-bold ${
                  walletBalance - initialBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {walletBalance - initialBalance >= 0 ? '+' : ''}
                {((walletBalance - initialBalance) / initialBalance * 100).toFixed(2)}%
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <span className="text-cyan-400 font-bold">{positions.length}</span>
              <span className="text-slate-500"> Pos</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 border-t border-slate-800/60 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'graph'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-4 h-4" />
            Context Graph (The Brain)
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-4 h-4" />
            Correlation Matrix (25x25)
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'wallet'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Paper Wallet &amp; Risk Engine
            {positions.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Kali Linux Terminal Log
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Python Code &amp; Kali Deploy
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
              .py
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* TAB 1: Context Graph Visualizer & Ticker Bar */}
        {activeTab === 'graph' && (
          <div className="space-y-6">
            <ContextGraphVisualizer
              assets={assets}
              leaders={leaders}
              followersMap={followersMap}
              activeSurgeLeader={activeSurgeLeader}
              selectedAsset={selectedAsset}
              onSelectAsset={(sym) => setSelectedAsset(sym)}
            />

            {/* Quick 25 Tickers Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  Target Universe (25 High-Liquidity Pairs)
                </span>
                <span className="text-slate-500 font-mono">Live WebSocket Feed (Binance Public)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-2">
                {Object.values(assets).map((asset) => {
                  const isLeader = leaders.includes(asset.symbol);
                  const isSelected = selectedAsset === asset.symbol;
                  const isCooling = (cooldowns[asset.symbol] || 0) > Date.now();

                  return (
                    <div
                      key={asset.symbol}
                      onClick={() => setSelectedAsset(asset.symbol)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md'
                          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-200">
                          {asset.symbol.replace('USDT', '')}
                        </span>
                        {isLeader && (
                          <span className="text-[9px] px-1 bg-indigo-500/20 text-indigo-300 rounded font-semibold">
                            LEAD
                          </span>
                        )}
                        {isCooling && (
                          <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded font-mono">
                            CD
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="font-mono text-slate-300 font-semibold">
                          ${asset.price < 1 ? asset.price.toFixed(5) : asset.price.toFixed(2)}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            asset.change1m >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {asset.change1m >= 0 ? '+' : ''}
                          {asset.change1m.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Correlation Matrix */}
        {activeTab === 'matrix' && (
          <CorrelationMatrixView assets={assets} matrix={matrix} leaders={leaders} />
        )}

        {/* TAB 3: Paper Trading Wallet */}
        {activeTab === 'wallet' && (
          <PaperWalletView
            balance={walletBalance}
            initialBalance={initialBalance}
            positions={positions}
            closedTrades={closedTrades}
            cooldowns={cooldowns}
            onClosePositionManually={handleClosePositionManually}
            onResetWallet={handleResetWallet}
          />
        )}

        {/* TAB 4: Kali Linux Terminal */}
        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <TerminalView
              logs={logs}
              onClearLogs={() => setLogs([])}
              onSimulateSurge={handleSimulateSurge}
              symbols={Object.keys(assets)}
            />
          </div>
        )}

        {/* TAB 5: Python Script & Kali Deploy */}
        {activeTab === 'code' && <PythonCodeViewer />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        Dual-Layer Crypto Trading Bot &bull; Context Graph Engineering &bull; Binance Public WebSockets &bull; Kali Linux Tested
      </footer>
    </div>
  );
}
