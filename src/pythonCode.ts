// This file exports the exact Python script content for user review and 1-click download in the UI.
export const PYTHON_SCRIPT_CODE = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===================================================================================
      DUAL-LAYER CRYPTO TRADING BOT WITH CONTEXT GRAPH ENGINEERING
                         & LIVE PAPER TRADING (BINANCE)
===================================================================================
Architecture:
  Layer 1: The Brain (Context Graph Swarm - Background Asyncio Engine)
    - Sub-agent swarm runs every 2 minutes in parallel.
    - Computes rolling price/volume correlation matrix (pandas & numpy).
    - Constructs directed Context Graph: Identifies Leaders & Highly Correlated Followers (r > 0.75).
  Layer 2: The Executioner (Sniper & Risk Engine - Public WebSockets)
    - Connects directly to Binance Public WebSockets (Zero API Keys required).
    - Detects Leader micro-surges (> 1.5% within 60s with elevated volume).
    - Traverses Context Graph to snipe lagging Followers (< 0.3% price move).
    - Automated Risk Engine: Take Profit (+2.5%), Stop Loss (-1.2%), and 15-minute Cooldown.
    - Real-time In-Memory Paper Wallet starting at 10,000 USDT.
===================================================================================
Target OS: Kali Linux / Debian / Ubuntu / Linux x86_64
Dependencies: asyncio, websockets, pandas, numpy, aiohttp
===================================================================================
"""

import sys
import os
import json
import time
import math
import logging
import asyncio
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set
from collections import deque

# Third-party data analysis and networking libraries
try:
    import numpy as np
    import pandas as pd
    import websockets
except ImportError as err:
    print(f"\\n[!] Missing dependency: {err}")
    print("[*] Install required packages on Kali Linux:")
    print("    pip install websockets pandas numpy aiohttp\\n")
    sys.exit(1)

# =================================================================================
# 1. TARGET SYMBOLS (TOP 25 HIGH-LIQUIDITY CRYPTOCURRENCIES)
# =================================================================================
TARGET_SYMBOLS: List[str] = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "ADAUSDT", "AVAXUSDT", "SUIUSDT", "DOTUSDT", "LINKUSDT",
    "NEARUSDT", "FETUSDT", "RENDERUSDT", "TAOUSDT", "OPUSDT",
    "ARBUSDT", "APTUSDT", "DOGEUSDT", "SHIBUSDT", "PEPEUSDT",
    "WIFUSDT", "BONKUSDT", "ONDOUSDT", "JUPUSDT", "STXUSDT"
]

# Static Sector & Behavioral Metadata for Context Graph clustering
# Broad Macro-Sector & Behavioral Clustering for Context Graph
SECTOR_MAP: Dict[str, str] = {
    # Sector: MEME COINS (High Retail Volatility & Cross-Reflexivity)
    "DOGEUSDT": "MEME",
    "SHIBUSDT": "MEME",
    "PEPEUSDT": "MEME",
    "WIFUSDT": "MEME",
    "BONKUSDT": "MEME",

    # Sector: AI & DECENTRALIZED COMPUTE
    "FETUSDT": "AI_COMPUTE",
    "RENDERUSDT": "AI_COMPUTE",
    "TAOUSDT": "AI_COMPUTE",
    "NEARUSDT": "AI_COMPUTE",

    # Sector: HIGH-PERFORMANCE LAYER 1 CHAINS
    "SOLUSDT": "L1_CHAINS",
    "SUIUSDT": "L1_CHAINS",
    "APTUSDT": "L1_CHAINS",
    "AVAXUSDT": "L1_CHAINS",
    "ADAUSDT": "L1_CHAINS",
    "DOTUSDT": "L1_CHAINS",
    "BNBUSDT": "L1_CHAINS",

    # Sector: LAYER 2 & BITCOIN ECOSYSTEM
    "STXUSDT": "L2_ECOSYSTEM",
    "OPUSDT": "L2_ECOSYSTEM",
    "ARBUSDT": "L2_ECOSYSTEM",

    # Sector: DEFI, ORACLES & RWA (Real World Assets)
    "LINKUSDT": "DEFI_RWA",
    "ONDOUSDT": "DEFI_RWA",
    "JUPUSDT": "DEFI_RWA",

    # Sector: GLOBAL PAYMENTS & SETTLEMENT
    "XRPUSDT": "PAYMENTS",

    # Market Anchors (Macro Direction Setters)
    "BTCUSDT": "MARKET_ANCHOR",
    "ETHUSDT": "MARKET_ANCHOR"
}

# =================================================================================
# KALI LINUX TERMINAL ANSI COLOR FORMATTER & LOGGING SETUP
# =================================================================================
class KaliColorFormatter(logging.Formatter):
    """Custom ANSI Terminal Color Formatter optimized for Kali Linux."""
    GREY = "\\033[90m"
    BLUE = "\\033[94m"
    CYAN = "\\033[96m"
    GREEN = "\\033[92m"
    YELLOW = "\\033[93m"
    RED = "\\033[91m"
    BOLD = "\\033[1m"
    RESET = "\\033[0m"
    MAGENTA = "\\033[95m"

    FORMATS = {
        logging.DEBUG: GREY + "[%(asctime)s] [DEBUG] %(message)s" + RESET,
        logging.INFO: CYAN + "[%(asctime)s] " + GREEN + "[INFO] " + RESET + "%(message)s",
        logging.WARNING: YELLOW + BOLD + "[%(asctime)s] [WARN] %(message)s" + RESET,
        logging.ERROR: RED + BOLD + "[%(asctime)s] [ERROR] %(message)s" + RESET,
        logging.CRITICAL: RED + BOLD + "[%(asctime)s] [CRITICAL] %(message)s" + RESET,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno, "%(asctime)s - %(levelname)s - %(message)s")
        formatter = logging.Formatter(log_fmt, datefmt="%Y-%m-%d %H:%M:%S")
        return formatter.format(record)

logger = logging.getLogger("DualLayerBot")
logger.setLevel(logging.INFO)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(KaliColorFormatter())
logger.addHandler(console_handler)

# =================================================================================
# 2. PAPER TRADING ENGINE (IN-MEMORY VIRTUAL WALLET & RISK RULES)
# =================================================================================
@dataclass
class Position:
    """Represents an active virtual trade with dynamic risk metrics."""
    symbol: str
    entry_price: float
    position_size_usd: float
    coins_amount: float
    entry_time: float
    take_profit_price: float
    stop_loss_price: float
    trigger_leader: str
    correlation: float
    highest_price: float = 0.0
    breakeven_active: bool = False
    trailing_active: bool = False

@dataclass
class ClosedTradeRecord:
    """Represents a finalized trade."""
    symbol: str
    entry_price: float
    exit_price: float
    return_pct: float
    pnl_usd: float
    exit_time: float
    reason: str
    wallet_balance_after: float

class PaperTradingEngine:
    """
    Virtual Wallet & Risk Management System.
    - Initial balance: 10,000 USDT in-memory.
    - Fixed position size: 500 USDT (or 5% of portfolio).
    - Dynamic Scalp Take Profit (+1.6%) and Stop Loss (-1.0%).
    - Breakeven Protection: Shifts SL to entry (+0.1%) upon reaching +0.70% gain.
    - Dynamic Trailing Stop: Trails at 0.40% from peak upon reaching +1.20% gain.
    - Cooldown: 10 minutes on stopped-out trades, 5 minutes on profitable trades.
    """
    def __init__(self, initial_balance: float = 10000.0, position_size_usd: float = 500.0):
        self.initial_balance: float = initial_balance
        self.current_balance: float = initial_balance
        self.position_size_usd: float = position_size_usd
        self.open_positions: Dict[str, Position] = {}
        self.closed_trades: List[ClosedTradeRecord] = []
        self.cooldowns: Dict[str, float] = {}  # symbol -> expiry timestamp
        self.cooldown_duration_loss: float = 10 * 60.0    # 10 min cooldown on loss
        self.cooldown_duration_profit: float = 5 * 60.0   # 5 min cooldown on profit

        self.take_profit_ratio: float = 0.016  # Scalp TP: +1.6%
        self.stop_loss_ratio: float = 0.010    # Risk SL: -1.0%
        self.lock = asyncio.Lock()

    def is_in_cooldown(self, symbol: str) -> Tuple[bool, float]:
        """Check if symbol is currently in cooldown. Returns (is_cooling, remaining_seconds)."""
        now = time.time()
        expiry = self.cooldowns.get(symbol, 0.0)
        if now < expiry:
            return True, expiry - now
        return False, 0.0

    def has_open_position(self, symbol: str) -> bool:
        """Check if position is currently active for symbol."""
        return symbol in self.open_positions

    async def open_position(
        self,
        symbol: str,
        current_price: float,
        trigger_leader: str,
        correlation: float
    ) -> Optional[Position]:
        """Opens a simulated long position if capital and risk rules permit."""
        async with self.lock:
            # Check conditions
            if self.has_open_position(symbol):
                return None

            is_cooling, rem = self.is_in_cooldown(symbol)
            if is_cooling:
                logger.info(f"[SNIPER SKIP] Cooldown active for {symbol}: {rem:.1f}s remaining.")
                return None

            # Calculate allocation (500 USDT or 5% of available balance, whichever is safer)
            allocated = min(self.position_size_usd, self.current_balance * 0.05)
            if self.current_balance < allocated or allocated <= 0:
                logger.warning(f"Insufficient virtual balance ({self.current_balance:.2f} USDT) to allocate {allocated:.2f} USDT.")
                return None

            # Execute virtual buy
            self.current_balance -= allocated
            coins = allocated / current_price
            tp_price = current_price * (1.0 + self.take_profit_ratio)
            sl_price = current_price * (1.0 - self.stop_loss_ratio)

            pos = Position(
                symbol=symbol,
                entry_price=current_price,
                position_size_usd=allocated,
                coins_amount=coins,
                entry_time=time.time(),
                take_profit_price=tp_price,
                stop_loss_price=sl_price,
                trigger_leader=trigger_leader,
                correlation=correlation,
                highest_price=current_price,
                breakeven_active=False,
                trailing_active=False
            )
            self.open_positions[symbol] = pos

            logger.info(
                f"\\033[92m\\033[1m[SNIPER BUY EXECUTED]\\033[0m {symbol} @ \${current_price:.6f} | "
                f"Size: {allocated:.2f} USDT | Trigger Leader: {trigger_leader} (r={correlation:.3f}) | "
                f"TP: \${tp_price:.6f} (+1.6%) | SL: \${sl_price:.6f} (-1.0%) | Breakeven @ +0.7%"
            )
            return pos

    async def evaluate_and_close_positions(self, latest_prices: Dict[str, float]) -> List[ClosedTradeRecord]:
        """
        Evaluates active positions against live prices.
        Enforces:
          1. Take Profit (+1.6%)
          2. Breakeven shift to entry +0.1% once profit >= +0.70%
          3. Trailing Stop (0.4% from peak) once profit >= +1.20%
          4. Hard Stop Loss (-1.0%)
          5. Time expiry (25 mins)
        """
        closed_this_tick: List[ClosedTradeRecord] = []
        now = time.time()

        async with self.lock:
            symbols_to_close = []

            for symbol, pos in self.open_positions.items():
                curr_price = latest_prices.get(symbol)
                if not curr_price or curr_price <= 0:
                    continue

                if curr_price > pos.highest_price:
                    pos.highest_price = curr_price

                current_gain_pct = ((curr_price - pos.entry_price) / pos.entry_price) * 100.0

                # 1. Breakeven Protection: Once gain reaches +0.70%, shift SL to Entry + 0.1%
                if current_gain_pct >= 0.70 and not pos.breakeven_active:
                    pos.breakeven_active = True
                    be_price = pos.entry_price * 1.001
                    if be_price > pos.stop_loss_price:
                        pos.stop_loss_price = be_price
                        logger.info(
                            f"\\033[93m[BREAKEVEN ARMED]\\033[0m {symbol} hit +{current_gain_pct:.2f}%. "
                            f"Stop loss raised to Breakeven (\${be_price:.6f}) to protect capital."
                        )

                # 2. Dynamic Trailing Stop: Once gain reaches +1.20%, trail at peak - 0.40%
                if current_gain_pct >= 1.20:
                    pos.trailing_active = True
                    trail_price = pos.highest_price * (1.0 - 0.004)
                    if trail_price > pos.stop_loss_price:
                        pos.stop_loss_price = trail_price

                # 3. Check Take Profit Hit
                if curr_price >= pos.take_profit_price:
                    symbols_to_close.append((symbol, curr_price, "TAKE_PROFIT"))

                # 4. Check Stop Loss / Breakeven / Trailing Hit
                elif curr_price <= pos.stop_loss_price:
                    reason = "TRAILING_STOP" if pos.trailing_active else ("BREAKEVEN_LOCK" if pos.breakeven_active else "STOP_LOSS")
                    symbols_to_close.append((symbol, curr_price, reason))

                # 5. Time-based Expiry (25 minutes without hitting targets)
                elif now - pos.entry_time >= 1500:
                    reason = "TIME_EXPIRY_PROFIT" if current_gain_pct > 0 else "TIME_EXPIRY_TIMEOUT"
                    symbols_to_close.append((symbol, curr_price, reason))

            for symbol, exit_price, reason in symbols_to_close:
                pos = self.open_positions.pop(symbol)
                exit_value = pos.coins_amount * exit_price
                pnl_usd = exit_value - pos.position_size_usd
                return_pct = ((exit_price - pos.entry_price) / pos.entry_price) * 100.0

                self.current_balance += exit_value
                # Cooldown based on trade outcome
                cooldown_dur = self.cooldown_duration_profit if return_pct >= 0 else self.cooldown_duration_loss
                self.cooldowns[symbol] = now + cooldown_dur

                record = ClosedTradeRecord(
                    symbol=symbol,
                    entry_price=pos.entry_price,
                    exit_price=exit_price,
                    return_pct=return_pct,
                    pnl_usd=pnl_usd,
                    exit_time=now,
                    reason=reason,
                    wallet_balance_after=self.current_balance
                )
                self.closed_trades.append(record)
                closed_this_tick.append(record)

                # Format required Arabic/Terminal report
                color = "\\033[92m" if return_pct >= 0 else "\\033[91m"
                bold = "\\033[1m"
                reset = "\\033[0m"

                report_line = (
                    f"\\n{bold}{'='*80}{reset}\\n"
                    f"{bold}🔔 [تقرير تنفيذ الصفقة المغلقة / CLOSED TRADE REPORT]{reset}\\n"
                    f"{bold}السبب: {reason} | الحجم: {pos.position_size_usd:.2f} USDT | مدة الاحتفاظ: {int(now - pos.entry_time)}s{reset}\\n"
                    f"{bold}[ اسم العملة: {symbol} | "
                    f"سعر الدخول: \${pos.entry_price:.6f} | "
                    f"سعر الخروج: \${exit_price:.6f} | "
                    f"النتيجة %: {color}{return_pct:+.2f}% ({pnl_usd:+.2f} USDT){reset}{bold} | "
                    f"الرصيد الحالي للمحفظة الوهمية: \${self.current_balance:.2f} USDT ]{reset}\\n"
                    f"🕒 فترة التهدئة مفعلة حتى: {datetime.fromtimestamp(self.cooldowns[symbol]).strftime('%H:%M:%S')}\\n"
                    f"{bold}{'='*80}{reset}\\n"
                )
                sys.stdout.write(report_line)
                sys.stdout.flush()

        return closed_this_tick

    def get_summary_stats(self, latest_prices: Optional[Dict[str, float]] = None) -> Dict:
        """Returns accurate portfolio performance metrics including live unrealized equity."""
        unrealized_pnl = 0.0
        open_positions_val = 0.0
        if latest_prices:
            for symbol, pos in self.open_positions.items():
                curr = latest_prices.get(symbol, pos.entry_price)
                val = pos.coins_amount * curr
                open_positions_val += val
                unrealized_pnl += (val - pos.position_size_usd)
        else:
            open_positions_val = sum(pos.position_size_usd for pos in self.open_positions.values())

        total_equity = self.current_balance + open_positions_val
        total_pnl = total_equity - self.initial_balance
        pnl_pct = (total_pnl / self.initial_balance) * 100.0
        wins = sum(1 for t in self.closed_trades if t.return_pct > 0)
        total_trades = len(self.closed_trades)
        win_rate = (wins / total_trades * 100.0) if total_trades > 0 else 0.0

        return {
            "initial_balance": self.initial_balance,
            "cash_balance": self.current_balance,
            "total_equity": total_equity,
            "unrealized_pnl": unrealized_pnl,
            "total_pnl_usd": total_pnl,
            "total_pnl_pct": pnl_pct,
            "open_positions_count": len(self.open_positions),
            "closed_trades_count": total_trades,
            "win_rate": win_rate
        }

# =================================================================================
# 3. HIERARCHICAL CONTEXT GRAPH & SWARM AGENT BRAIN
# =================================================================================
@dataclass
class ContextNode:
    symbol: str
    sector: str
    momentum_1m: float
    volume_delta: float
    is_leader: bool
    followers: List[Tuple[str, float]]  # List of (follower_symbol, correlation)

class ContextGraph:
    """
    In-memory representation of the dynamic Market Graph.
    Identifies behavioral clusters, Leaders, and Correlated Followers (r >= 0.65).
    """
    def __init__(self):
        self.timestamp: float = time.time()
        self.correlation_matrix: Optional[pd.DataFrame] = None
        self.nodes: Dict[str, ContextNode] = {}
        self.leaders: Set[str] = set()
        self.leader_to_followers: Dict[str, List[Tuple[str, float]]] = {}

    def get_lagging_followers_for_leader(
        self,
        leader: str,
        current_1m_moves: Dict[str, float],
        min_correlation: float = 0.65,
        max_follower_move: float = 0.45,
        min_follower_move: float = -1.2,
        leader_move: float = 1.5
    ) -> List[Tuple[str, float, float, float]]:
        """
        Returns list of (follower_symbol, correlation, current_1m_move, lag_score)
        where:
          - correlation >= min_correlation (default 0.65)
          - follower has lagged behind (min_follower_move <= move < max_follower_move)
          - sorted descending by arbitrage lag score = corr * (leader_move - f_move)
        """
        valid_followers = []
        followers = self.leader_to_followers.get(leader, [])
        for f_sym, corr in followers:
            if corr < min_correlation:
                continue
            f_move = current_1m_moves.get(f_sym, 0.0)
            if min_follower_move <= f_move < max_follower_move:
                lag_gap = leader_move - f_move
                score = corr * lag_gap
                valid_followers.append((f_sym, float(corr), f_move, score))

        # Sort descending by arbitrage score (highest lag gap * correlation)
        valid_followers.sort(key=lambda x: x[3], reverse=True)
        return valid_followers

class ContextGraphEngine:
    """
    The Brain: Background Swarm Task.
    - Gathers rolling price/volume series in high-capacity buffer.
    - Synchronizes asynchronous tick feeds onto fixed-step time bins (resampling)
      to eliminate the Epps Effect.
    - Regularizes empirical return correlation with a Bayesian Macro-Sector Prior.
    - Executes parallel sub-agents every 2 minutes.
    """
    def __init__(self, symbols: List[str], window_size: int = 360):
        self.symbols = symbols
        self.window_size = window_size  # 360 snapshots (~6-10 minutes of buffer)
        # Store rolling price & volume history: symbol -> deque of (timestamp, price, volume)
        self.history: Dict[str, deque] = {s: deque(maxlen=self.window_size) for s in self.symbols}
        self.current_graph: ContextGraph = ContextGraph()
        self.lock = asyncio.Lock()
        self.last_update_time: float = 0.0

    def record_snapshot(self, symbol: str, price: float, volume_24h: float):
        """Append price and volume tick into rolling window."""
        if symbol in self.history:
            self.history[symbol].append((time.time(), price, volume_24h))

    def _get_resampled_price_matrix(self, grid_span: float = 300.0, grid_step: float = 5.0) -> Optional[pd.DataFrame]:
        """
        Aligns asynchronous tick feeds onto a synchronized time grid using linear interpolation.
        This provides synchronous price steps so percentage returns across all 25 assets
        share identical time intervals, solving the vanishing empirical correlation problem.
        """
        now = time.time()
        grid_times = np.arange(now - grid_span, now, grid_step)
        if len(grid_times) < 10:
            return None

        synced = {}
        for sym in self.symbols:
            dq = self.history.get(sym)
            if not dq or len(dq) < 4:
                continue
            ts_arr = np.array([item[0] for item in dq])
            pr_arr = np.array([item[1] for item in dq])

            # Ensure we have at least 25 seconds of observations
            if ts_arr[-1] - ts_arr[0] >= 25.0:
                # Interpolate price at each synchronized time grid point
                interp_prices = np.interp(grid_times, ts_arr, pr_arr)
                synced[sym] = interp_prices

        if len(synced) >= 5:
            return pd.DataFrame(synced, index=grid_times)
        return None

    def _build_sector_prior_matrix(self, symbols_subset: List[str]) -> pd.DataFrame:
        """
        Constructs the Bayesian Sector Prior correlation matrix.
        - Same Macro-Sector: 0.82
        - Versus Market Anchors (BTC/ETH): 0.65
        - Cross-Sector: 0.35
        - Self: 1.0
        """
        n = len(symbols_subset)
        prior = np.full((n, n), 0.35, dtype=float)
        np.fill_diagonal(prior, 1.0)

        for i, s1 in enumerate(symbols_subset):
            sec1 = SECTOR_MAP.get(s1, "GENERAL")
            for j, s2 in enumerate(symbols_subset):
                if i == j:
                    continue
                sec2 = SECTOR_MAP.get(s2, "GENERAL")
                if sec1 == sec2:
                    prior[i, j] = 0.82
                elif sec1 == "MARKET_ANCHOR" or sec2 == "MARKET_ANCHOR":
                    prior[i, j] = 0.65
                else:
                    prior[i, j] = 0.38

        return pd.DataFrame(prior, index=symbols_subset, columns=symbols_subset)

    async def _sub_agent_analyze_asset(self, symbol: str) -> Dict:
        """
        Sub-Agent worker running asynchronously in parallel.
        Extracts statistical features for a specific asset.
        """
        history_deque = self.history.get(symbol, deque())
        if len(history_deque) < 5:
            return {
                "symbol": symbol,
                "prices": [],
                "volumes": [],
                "momentum_1m": 0.0,
                "volatility": 0.0,
                "volume_delta": 0.0
            }

        prices = [h[1] for h in history_deque]
        volumes = [h[2] for h in history_deque]

        # Recent 1-minute delta
        now_ts = history_deque[-1][0]
        one_min_ago_idx = 0
        for i in range(len(history_deque) - 1, -1, -1):
            if now_ts - history_deque[i][0] >= 60:
                one_min_ago_idx = i
                break

        p_current = prices[-1]
        p_1m_ago = prices[one_min_ago_idx] if one_min_ago_idx < len(prices) else prices[0]
        momentum_1m = ((p_current - p_1m_ago) / p_1m_ago) * 100.0 if p_1m_ago > 0 else 0.0

        # Rolling returns & volatility
        price_series = pd.Series(prices)
        returns = price_series.pct_change().dropna()
        volatility = float(returns.std()) if len(returns) > 1 else 0.0

        v_current = volumes[-1]
        v_prev = volumes[0]
        volume_delta = ((v_current - v_prev) / v_prev) * 100.0 if v_prev > 0 else 0.0

        return {
            "symbol": symbol,
            "prices": prices,
            "volumes": volumes,
            "momentum_1m": momentum_1m,
            "volatility": volatility,
            "volume_delta": volume_delta
        }

    async def build_context_graph(self) -> ContextGraph:
        """
        Computes the regularized correlation matrix and synthesizes the Context Graph.
        Executes parallel swarm sub-agents via asyncio.gather.
        """
        start_time = time.time()
        logger.info("\\033[94m[THE BRAIN] Swarm sub-agents launching parallel market scan across 25 assets...\\033[0m")

        # Spawn sub-agent tasks concurrently
        tasks = [self._sub_agent_analyze_asset(sym) for sym in self.symbols]
        sub_agent_results = await asyncio.gather(*tasks, return_exceptions=True)

        features: Dict[str, Dict] = {}
        for res in sub_agent_results:
            if isinstance(res, Exception) or not isinstance(res, dict):
                continue
            sym = res["symbol"]
            features[sym] = res

        new_graph = ContextGraph()
        new_graph.timestamp = time.time()

        # Resample price feeds onto synchronous time grid
        df_synced = self._get_resampled_price_matrix(grid_span=300.0, grid_step=5.0)

        if df_synced is not None and len(df_synced.columns) >= 5:
            # Synchronous percentage returns
            df_returns = df_synced.pct_change().dropna()
            active_symbols = list(df_synced.columns)

            if len(df_returns) >= 5:
                emp_corr = df_returns.corr(method="pearson").fillna(0.0)
            else:
                emp_corr = pd.DataFrame(np.eye(len(active_symbols)), index=active_symbols, columns=active_symbols)

            # Bayesian Regularization: Blend 55% Synchronous Empirical + 45% Sector Prior
            sector_prior = self._build_sector_prior_matrix(active_symbols)
            blended_corr = 0.55 * emp_corr + 0.45 * sector_prior
            # Ensure diagonal is exactly 1.0 and bounds are [-1, 1]
            np.fill_diagonal(blended_corr.values, 1.0)
            blended_corr = blended_corr.clip(-1.0, 1.0)

            new_graph.correlation_matrix = blended_corr

            # Rank dynamic Leaders based on momentum & volume
            candidate_leaders: List[Tuple[str, float]] = []
            for sym, feat in features.items():
                score = feat["momentum_1m"] * 1.5 + (feat["volume_delta"] * 0.1)
                candidate_leaders.append((sym, score))

            candidate_leaders.sort(key=lambda x: x[1], reverse=True)
            top_leaders = {s for s, _ in candidate_leaders[:6]}  # Top 6 momentum candidates
            new_graph.leaders = top_leaders

            # Construct graph edges for correlated followers (calibrated r >= 0.65)
            for leader in top_leaders:
                new_graph.leader_to_followers[leader] = []
                if leader in blended_corr.columns:
                    corrs = blended_corr[leader]
                    for other_sym, r_val in corrs.items():
                        if other_sym != leader and r_val >= 0.65:
                            new_graph.leader_to_followers[leader].append((other_sym, float(r_val)))

            # Populate nodes
            for sym in self.symbols:
                feat = features.get(sym, {})
                new_graph.nodes[sym] = ContextNode(
                    symbol=sym,
                    sector=SECTOR_MAP.get(sym, "GENERAL"),
                    momentum_1m=feat.get("momentum_1m", 0.0),
                    volume_delta=feat.get("volume_delta", 0.0),
                    is_leader=(sym in top_leaders),
                    followers=new_graph.leader_to_followers.get(sym, [])
                )
        else:
            # Baseline Bayesian Sector Graph during initial warmup
            logger.info("[THE BRAIN] Warmup phase: Synthesizing baseline sectoral correlation graph...")
            active_symbols = self.symbols
            sector_prior = self._build_sector_prior_matrix(active_symbols)
            new_graph.correlation_matrix = sector_prior

            top_leaders = {"BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT", "AVAXUSDT"}
            new_graph.leaders = top_leaders

            for leader in top_leaders:
                new_graph.leader_to_followers[leader] = []
                corrs = sector_prior[leader]
                for other_sym, r_val in corrs.items():
                    if other_sym != leader and r_val >= 0.65:
                        new_graph.leader_to_followers[leader].append((other_sym, float(r_val)))

            for sym in self.symbols:
                feat = features.get(sym, {})
                new_graph.nodes[sym] = ContextNode(
                    symbol=sym,
                    sector=SECTOR_MAP.get(sym, "GENERAL"),
                    momentum_1m=feat.get("momentum_1m", 0.0),
                    volume_delta=feat.get("volume_delta", 0.0),
                    is_leader=(sym in top_leaders),
                    followers=new_graph.leader_to_followers.get(sym, [])
                )
                if sym in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]:
                    new_graph.leaders.add(sym)
                    new_graph.leader_to_followers[sym] = peers

        async with self.lock:
            self.current_graph = new_graph
            self.last_update_time = time.time()

        elapsed = time.time() - start_time
        logger.info(
            f"\\033[92m[THE BRAIN UPDATED]\\033[0m Context Graph built in {elapsed:.2f}s | "
            f"Identified Leaders: {list(new_graph.leaders)} | "
            f"High-Correlation Edges (r >= 0.65): {sum(len(f) for f in new_graph.leader_to_followers.values())}"
        )
        return new_graph

    async def get_latest_graph(self) -> ContextGraph:
        """Atomic access to latest graph."""
        async with self.lock:
            return self.current_graph

# =================================================================================
# 4. THE EXECUTIONER & SNIPER LAYER (BINANCE PUBLIC WEBSOCKETS)
# =================================================================================
class SniperExecutioner:
    """
    Layer 2: The Executioner.
    - Maintains persistent real-time streaming WebSocket connection to Binance.
    - Monitors tick-by-tick prices and 60-second momentum.
    - Detects Leader surges (> 1.5% in 1 minute).
    - Traverses Context Graph to snipe lagging correlated Followers (< 0.3%).
    - Enforces Take Profit (+2.5%), Stop Loss (-1.2%), and 15-minute cooldowns.
    """
    # Multiple resilient Binance endpoints (Vision endpoint bypasses Cloudflare 403 blocks)
    BINANCE_WS_ENDPOINTS = [
        "wss://data-stream.binance.vision/stream?streams=",
        "wss://stream.binance.com:443/stream?streams=",
        "wss://stream.binance.com:9443/stream?streams=",
        "wss://stream.binance.us:9443/stream?streams="
    ]
    REST_API_ENDPOINTS = [
        "https://data-api.binance.vision/api/v3/ticker/24hr",
        "https://api.binance.com/api/v3/ticker/24hr"
    ]

    def __init__(
        self,
        symbols: List[str],
        brain: ContextGraphEngine,
        wallet: PaperTradingEngine
    ):
        self.symbols = symbols
        self.brain = brain
        self.wallet = wallet

        # Real-time state caches
        self.latest_prices: Dict[str, float] = {}
        self.price_history_1m: Dict[str, deque] = {s: deque(maxlen=60) for s in self.symbols}
        self.latest_volumes_24h: Dict[str, float] = {}
        self.running: bool = False
        self._current_endpoint_idx: int = 0
        self._last_surge_time: Dict[str, float] = {}  # Throttle surge scans per symbol

    def _get_connect_kwargs(self) -> Dict:
        """Constructs compatible websocket connection kwargs with anti-bot User-Agent."""
        import inspect
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }
        kwargs = {
            "ping_interval": 20,
            "ping_timeout": 20,
            "close_timeout": 10,
        }
        try:
            sig = inspect.signature(websockets.connect)
            if "additional_headers" in sig.parameters:
                kwargs["additional_headers"] = headers
            elif "extra_headers" in sig.parameters:
                kwargs["extra_headers"] = headers
        except Exception:
            pass
        return kwargs

    def _calculate_1m_move(self, symbol: str) -> float:
        """Calculates exact 1-minute percentage price delta from tick buffer."""
        dq = self.price_history_1m.get(symbol)
        if not dq or len(dq) < 2:
            return 0.0

        now_ts, p_now = dq[-1]
        target_ts = now_ts - 60.0
        best_p = None
        min_diff = 999999.0

        for ts, p in reversed(dq):
            diff = abs(ts - target_ts)
            if diff < min_diff:
                min_diff = diff
                best_p = p
            if ts <= target_ts:
                break

        if best_p is None or best_p <= 0:
            best_p = dq[0][1]

        if best_p <= 0:
            return 0.0
        return ((p_now - best_p) / best_p) * 100.0

    async def _handle_price_tick(self, symbol: str, current_price: float, volume_24h: float):
        """Processes an incoming tick for an asset."""
        now = time.time()
        self.latest_prices[symbol] = current_price
        self.latest_volumes_24h[symbol] = volume_24h

        # Update 1m buffer and brain buffer
        self.price_history_1m[symbol].append((now, current_price))
        self.brain.record_snapshot(symbol, current_price, volume_24h)

        # 1. Manage existing positions (TP / Breakeven / Trailing SL evaluation)
        await self.wallet.evaluate_and_close_positions(self.latest_prices)

        # 2. Compute 1-minute move for current symbol
        move_1m = self._calculate_1m_move(symbol)

        # 3. Check for sudden Leader breakout (> 1.2% in 60 seconds with 20s debounce)
        last_surge = self._last_surge_time.get(symbol, 0.0)
        if move_1m >= 1.20 and (now - last_surge >= 20.0):
            self._last_surge_time[symbol] = now
            await self._process_leader_surge_signal(symbol, move_1m)

    async def _process_leader_surge_signal(self, leader_symbol: str, leader_move_1m: float):
        """
        Executed when an asset surges >= 1.2% in 60 seconds.
        Traverses the Context Graph and Macro-Sector clusters for lagging followers.
        """
        graph = await self.brain.get_latest_graph()

        # Is registered as a Leader OR acting as a Breakout Leader (move >= 1.5%)
        is_leader = (leader_symbol in graph.leaders) or (leader_move_1m >= 1.50)
        if not is_leader:
            return

        logger.info(
            f"\\033[93m\\033[1m[LEADER SURGE DETECTED]\\033[0m {leader_symbol} surged "
            f"\\033[92m+{leader_move_1m:.2f}%\\033[0m in 60s! Traversing Context Graph for lagging followers..."
        )

        current_1m_moves = {s: self._calculate_1m_move(s) for s in self.symbols}

        # 1. Graph Correlated Followers (r >= 0.65, move < 0.45%)
        raw_candidates = graph.get_lagging_followers_for_leader(
            leader=leader_symbol,
            current_1m_moves=current_1m_moves,
            min_correlation=0.65,
            max_follower_move=0.45,
            min_follower_move=-1.2,
            leader_move=leader_move_1m
        )

        # Structure candidates list: (symbol, correlation, move, lag_score)
        candidates: List[Tuple[str, float, float, float]] = list(raw_candidates)

        # 2. Macro-Sector Peers as additional high-confidence candidates
        sector = SECTOR_MAP.get(leader_symbol)
        if sector and sector != "MARKET_ANCHOR":
            for s in self.symbols:
                if s != leader_symbol and SECTOR_MAP.get(s) == sector:
                    s_move = current_1m_moves.get(s, 0.0)
                    if -1.2 <= s_move < 0.45:
                        if not any(c[0] == s for c in candidates):
                            lag_gap = leader_move_1m - s_move
                            candidates.append((s, 0.82, s_move, 0.82 * lag_gap))

        # 3. Macro Market Anchor Spillover (if BTC or ETH surges > 1.2%)
        elif sector == "MARKET_ANCHOR":
            for s in self.symbols:
                if SECTOR_MAP.get(s) not in ["MARKET_ANCHOR"]:
                    s_move = current_1m_moves.get(s, 0.0)
                    if -1.0 <= s_move < 0.35:
                        if not any(c[0] == s for c in candidates):
                            lag_gap = leader_move_1m - s_move
                            candidates.append((s, 0.70, s_move, 0.70 * lag_gap))

        # Filter out cooling, already open, or invalid pricing
        eligible = []
        for sym, corr, move, score in candidates:
            if self.wallet.has_open_position(sym):
                continue
            is_cooling, _ = self.wallet.is_in_cooldown(sym)
            if is_cooling:
                continue
            price = self.latest_prices.get(sym, 0.0)
            if price <= 0:
                continue
            eligible.append((sym, corr, move, score, price))

        if not eligible:
            logger.info(f"[SNIPER SCAN] No eligible lagging followers found for {leader_symbol} (all moved, cooling, or active).")
            return

        # Sort descending by Arbitrage Score = correlation * lag_gap
        eligible.sort(key=lambda x: x[3], reverse=True)
        target_symbol, corr, target_move, score, target_price = eligible[0]

        # Execute Sniper Entry via Paper Wallet
        logger.info(
            f"\\033[96m\\033[1m[SNIPER LOCK-ON]\\033[0m Target: \\033[92m{target_symbol}\\033[0m | "
            f"Lag Move: {target_move:+.2f}% (Gap: +{leader_move_1m - target_move:.2f}%) | "
            f"Correlated with Leader {leader_symbol} (r={corr:.2f}, Score={score:.2f})"
        )
        await self.wallet.open_position(
            symbol=target_symbol,
            current_price=target_price,
            trigger_leader=leader_symbol,
            correlation=corr
        )

    async def run_websocket_stream(self):
        """
        Connects to Binance Public Combined WebSocket stream.
        Streams real-time 24hr miniTickers for all 25 target symbols.
        Cycles across multiple mirror endpoints (including Binance Vision) with custom headers.
        """
        streams = [f"{s.lower()}@miniTicker" for s in self.symbols]
        streams_query = "/".join(streams)
        backoff_seconds = 2.0
        consecutive_failures = 0

        while self.running:
            base_url = self.BINANCE_WS_ENDPOINTS[self._current_endpoint_idx]
            combined_url = base_url + streams_query
            endpoint_name = base_url.split("/")[2]

            logger.info(f"[EXECUTIONER] Connecting to Binance Stream via \\033[96m{endpoint_name}\\033[0m ({len(self.symbols)} streams)...")

            try:
                connect_kwargs = self._get_connect_kwargs()
                async with websockets.connect(combined_url, **connect_kwargs) as ws:
                    logger.info(f"\\033[92m\\033[1m[WEBSOCKET CONNECTED]\\033[0m Successfully streaming real-time ticks from {endpoint_name}.")
                    backoff_seconds = 2.0
                    consecutive_failures = 0

                    while self.running:
                        message = await ws.recv()
                        data = json.loads(message)

                        # Binance combined stream wraps payload in {"stream": "...", "data": {...}}
                        payload = data.get("data", data)
                        symbol = payload.get("s")
                        close_price_raw = payload.get("c")
                        volume_raw = payload.get("v")

                        if symbol and close_price_raw and symbol in self.price_history_1m:
                            try:
                                close_price = float(close_price_raw)
                                volume_24h = float(volume_raw) if volume_raw else 0.0
                                await self._handle_price_tick(symbol, close_price, volume_24h)
                            except (ValueError, TypeError):
                                continue

            except asyncio.CancelledError:
                logger.info("[EXECUTIONER] WebSocket task cancelled.")
                break
            except Exception as e:
                consecutive_failures += 1
                # Switch to alternative endpoint
                prev_endpoint = endpoint_name
                self._current_endpoint_idx = (self._current_endpoint_idx + 1) % len(self.BINANCE_WS_ENDPOINTS)
                next_endpoint = self.BINANCE_WS_ENDPOINTS[self._current_endpoint_idx].split("/")[2]

                logger.warning(
                    f"\\033[91m[WEBSOCKET NOTICE]\\033[0m Connection to {prev_endpoint} returned ({e}). "
                    f"Failover to mirror \\033[93m{next_endpoint}\\033[0m in {backoff_seconds:.1f}s..."
                )

                # If all websocket endpoints encounter repeated Cloudflare/network blocks, activate aiohttp REST poller
                if consecutive_failures >= 4:
                    logger.info("\\033[93m[EXECUTIONER FAILOVER]\\033[0m Engaging asynchronous REST live stream fallback via aiohttp...\\033[0m")
                    await self._run_rest_polling_session(duration_seconds=30)
                    consecutive_failures = 0

                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 1.3, 15.0)

    async def _run_rest_polling_session(self, duration_seconds: int = 30):
        """High-frequency REST fallback when WebSockets are blocked by ISP/firewall."""
        try:
            import aiohttp
            end_time = time.time() + duration_seconds
            timeout = aiohttp.ClientTimeout(total=5)
            headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/124.0"}

            async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                while self.running and time.time() < end_time:
                    for endpoint in self.REST_API_ENDPOINTS:
                        try:
                            symbols_json = json.dumps(self.symbols)
                            url = f"{endpoint}?symbols={symbols_json}"
                            async with session.get(url) as resp:
                                if resp.status == 200:
                                    tickers = await resp.json()
                                    for t in tickers:
                                        sym = t.get("symbol")
                                        if sym in self.symbols:
                                            price = float(t.get("lastPrice", 0))
                                            vol = float(t.get("volume", 0))
                                            if price > 0:
                                                await self._handle_price_tick(sym, price, vol)
                                    break
                        except Exception:
                            continue
                    await asyncio.sleep(1.5)
        except Exception as e:
            logger.debug(f"[REST FALLBACK] Poll error: {e}")

# =================================================================================
# 5. DUAL-LAYER TRADING BOT SUPERVISOR & ORCHESTRATOR
# =================================================================================
class DualLayerCryptoBot:
    """
    Main Bot Orchestrator.
    Coordinates:
      1. Brain background task (Context Graph generation every 2 minutes).
      2. Executioner WebSocket stream (Public tick streaming & Sniper order engine).
      3. Live Terminal Dashboard monitor.
    """
    def __init__(self):
        self.symbols = TARGET_SYMBOLS
        self.wallet = PaperTradingEngine(initial_balance=10000.0, position_size_usd=500.0)
        self.brain = ContextGraphEngine(symbols=self.symbols, window_size=360)
        self.executioner = SniperExecutioner(
            symbols=self.symbols,
            brain=self.brain,
            wallet=self.wallet
        )
        self.is_running = False

    async def _brain_loop(self):
        """Runs the Context Graph Swarm every 2 minutes (120 seconds)."""
        logger.info("[THE BRAIN] Background swarm loop initialized. Cycle interval: 120s.")
        # Initial warmup graph
        await self.brain.build_context_graph()

        while self.is_running:
            try:
                await asyncio.sleep(120)
                if not self.is_running:
                    break
                await self.brain.build_context_graph()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[THE BRAIN ERROR] Exception during graph update: {e}", exc_info=True)
                await asyncio.sleep(10)

    async def _dashboard_loop(self):
        """Prints high-level portfolio and market status to the terminal periodically."""
        while self.is_running:
            try:
                await asyncio.sleep(30)
                stats = self.wallet.get_summary_stats(self.executioner.latest_prices)
                now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

                pnl_color = "\\033[92m" if stats["total_pnl_usd"] >= 0 else "\\033[91m"
                reset = "\\033[0m"

                # Format active positions with live unrealized gain
                pos_details = []
                for sym, pos in self.wallet.open_positions.items():
                    curr = self.executioner.latest_prices.get(sym, pos.entry_price)
                    unrealized_pct = ((curr - pos.entry_price) / pos.entry_price) * 100.0
                    u_col = "\\033[92m" if unrealized_pct >= 0 else "\\033[91m"
                    pos_details.append(f"{sym} ({u_col}{unrealized_pct:+.2f}%{reset})")

                pos_str = ", ".join(pos_details) if pos_details else "None"

                banner = (
                    f"\\n\\033[90m{'─'*80}\\033[0m\\n"
                    f"\\033[1m📊 [STATUS UPDATE - {now_str}]\\033[0m\\n"
                    f"  💼 Portfolio Equity: \\033[92m\${stats['total_equity']:.2f} USDT\\033[0m (Cash: \${stats['cash_balance']:.2f}) | "
                    f"Net PnL: {pnl_color}{stats['total_pnl_usd']:+.2f} USDT ({stats['total_pnl_pct']:+.2f}%){reset} | "
                    f"Win Rate: {stats['win_rate']:.1f}% ({stats['closed_trades_count']} trades)\\n"
                    f"  🎯 Open Positions ({stats['open_positions_count']}): {pos_str}\\n"
                    f"\\033[90m{'─'*80}\\033[0m\\n"
                )
                sys.stdout.write(banner)
                sys.stdout.flush()
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    def print_welcome_banner(self):
        """Prints initialization banner formatted for Kali Linux."""
        banner = r"""
  ██████╗ ██╗   ██╗ █████╗ ██╗         ██╗      █████╗ ██╗   ██╗███████╗██████╗ 
  ██╔══██╗██║   ██║██╔══██╗██║         ██║     ██╔══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
  ██║  ██║██║   ██║███████║██║         ██║     ███████║ ╚████╔╝ █████╗  ██████╔╝
  ██║  ██║██║   ██║██╔══██║██║         ██║     ██╔══██║  ╚██╔╝  ██╔══╝  ██╔══██╗
  ██████╔╝╚██████╔╝██║  ██║███████╗    ███████╗██║  ██║   ██║   ███████╗██║  ██║
  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
  >>> DUAL-LAYER CRYPTO BOT: CONTEXT GRAPH & BINANCE PUBLIC SNIPER <<<
        """
        print(f"\\033[96m\\033[1m{banner}\\033[0m")
        print("\\033[1m[*] Operating System:\\033[0m Kali Linux / Linux x86_64")
        print(f"\\033[1m[*] Target Universe:\\033[0m {len(self.symbols)} Top Liquidity Pairs across 7 Macro-Sectors")
        print(f"\\033[1m[*] Initial Paper Balance:\\033[0m {self.wallet.initial_balance:,.2f} USDT")
        print(f"\\033[1m[*] Trade Allocation:\\033[0m {self.wallet.position_size_usd:,.2f} USDT (or 5% of balance)")
        print(f"\\033[1m[*] Dynamic Risk Rules:\\033[0m Scalp TP: +1.6% | Breakeven SL: +0.7% | Trailing Stop: +1.2% | Max SL: -1.0%")
        print(f"\\033[1m[*] Context Graph Engine:\\033[0m Synchronous Resampling + Bayesian Sector Prior | Swarm Cycle: 120s | r >= 0.65")
        print("\\033[93m[*] Press Ctrl+C at any time to gracefully shutdown.\\033[0m\\n")

    async def start(self):
        """Starts all concurrent asynchronous tasks."""
        self.is_running = True
        self.executioner.running = True
        self.print_welcome_banner()

        tasks = [
            asyncio.create_task(self._brain_loop(), name="BrainTask"),
            asyncio.create_task(self.executioner.run_websocket_stream(), name="ExecutionerTask"),
            asyncio.create_task(self._dashboard_loop(), name="DashboardTask")
        ]

        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("[BOT] Shutdown signal received. Cleaning up tasks...")
        finally:
            self.is_running = False
            self.executioner.running = False
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            self.print_final_summary()

    def print_final_summary(self):
        """Prints final trading statement upon termination."""
        stats = self.wallet.get_summary_stats()
        print("\\n\\033[95m\\033[1m" + "="*80)
        print("                  SESSION SUMMARY REPORT / تقرير ختام الجلسة")
        print("="*80 + "\\033[0m")
        print(f"  • الرصيد الابتدائي (Initial Balance):   \${stats['initial_balance']:,.2f} USDT")
        print(f"  • الرصيد النهائي (Final Balance):       \${stats['current_balance']:,.2f} USDT")
        color = "\\033[92m" if stats['total_pnl_usd'] >= 0 else "\\033[91m"
        print(f"  • صافي الربح/الخسارة (Total PnL):      {color}\${stats['total_pnl_usd']:+,.2f} USDT ({stats['total_pnl_pct']:+.2f}%)\\033[0m")
        print(f"  • عدد الصفقات المنفذة (Total Trades):  {stats['closed_trades_count']}")
        print(f"  • نسبة النجاح (Win Rate):              {stats['win_rate']:.1f}%")
        print(f"  • الصفقات المفتوحة المتبقية:          {stats['open_positions_count']}")
        print("\\033[95m\\033[1m" + "="*80 + "\\033[0m\\n")

# =================================================================================
# 6. ENTRY POINT
# =================================================================================
def main():
    """Script entry point with clean interrupt handling."""
    # Enforce UTF-8 output encoding
    if sys.stdout.encoding.lower() != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except AttributeError:
            pass

    bot = DualLayerCryptoBot()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(bot.start())
    except KeyboardInterrupt:
        logger.info("\\n\\033[93m[!] Keyboard interrupt received (Ctrl+C). Shutting down bot gracefully...\\033[0m")
        # Allow cancellation cleanup
        tasks = asyncio.all_tasks(loop=loop)
        for t in tasks:
            t.cancel()
        loop.run_until_complete(asyncio.gather(*tasks, return_exceptions=True))
    finally:
        loop.close()
        logger.info("[✓] Bot process exited cleanly.")

if __name__ == "__main__":
    main()
`;
