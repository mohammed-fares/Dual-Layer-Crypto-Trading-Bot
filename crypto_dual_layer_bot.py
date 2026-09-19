#!/usr/bin/env python3
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
    print(f"\n[!] Missing dependency: {err}")
    print("[*] Install required packages on Kali Linux:")
    print("    pip install websockets pandas numpy aiohttp\n")
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
SECTOR_MAP: Dict[str, str] = {
    "BTCUSDT": "MegaCap/StoreOfValue",
    "ETHUSDT": "MegaCap/SmartContracts",
    "BNBUSDT": "ExchangeToken/BSC",
    "SOLUSDT": "L1_HighPerformance",
    "SUIUSDT": "L1_HighPerformance",
    "APTUSDT": "L1_HighPerformance",
    "AVAXUSDT": "L1_Alternative",
    "ADAUSDT": "L1_Alternative",
    "DOTUSDT": "L1_Interoperability",
    "NEARUSDT": "L1_AI_Sharding",
    "STXUSDT": "Bitcoin_L2",
    "OPUSDT": "Ethereum_L2",
    "ARBUSDT": "Ethereum_L2",
    "LINKUSDT": "DeFi_Oracle",
    "ONDOUSDT": "RWA_DeFi",
    "JUPUSDT": "Solana_DeFi",
    "FETUSDT": "AI_Agents",
    "RENDERUSDT": "AI_GPU_Compute",
    "TAOUSDT": "AI_Decentralized_Intelligence",
    "DOGEUSDT": "Meme_OG",
    "SHIBUSDT": "Meme_Ecosystem",
    "PEPEUSDT": "Meme_Modern",
    "WIFUSDT": "Meme_Solana",
    "BONKUSDT": "Meme_Solana",
    "XRPUSDT": "Payment_CrossBorder"
}

# =================================================================================
# KALI LINUX TERMINAL ANSI COLOR FORMATTER & LOGGING SETUP
# =================================================================================
class KaliColorFormatter(logging.Formatter):
    """Custom ANSI Terminal Color Formatter optimized for Kali Linux."""
    GREY = "\033[90m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    RESET = "\033[0m"
    MAGENTA = "\033[95m"

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
    """Represents an active virtual trade."""
    symbol: str
    entry_price: float
    position_size_usd: float
    coins_amount: float
    entry_time: float
    take_profit_price: float
    stop_loss_price: float
    trigger_leader: str
    correlation: float

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
    Virtual Wallet & Order Management System.
    - Initial balance: 10,000 USDT in-memory.
    - Fixed position size: 500 USDT (or 5% of portfolio).
    - Dynamic Take Profit (+2.5%) and Stop Loss (-1.2%).
    - 15-minute cooldown tracking per closed symbol.
    """
    def __init__(self, initial_balance: float = 10000.0, position_size_usd: float = 500.0):
        self.initial_balance: float = initial_balance
        self.current_balance: float = initial_balance
        self.position_size_usd: float = position_size_usd
        self.open_positions: Dict[str, Position] = {}
        self.closed_trades: List[ClosedTradeRecord] = []
        self.cooldowns: Dict[str, float] = {}  # symbol -> expiry timestamp
        self.cooldown_duration: float = 15 * 60.0  # 15 minutes in seconds

        self.take_profit_ratio: float = 0.025  # +2.5%
        self.stop_loss_ratio: float = 0.012    # -1.2%
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
                logger.warning(f"Cooldown active for {symbol}: {rem:.1f}s remaining. Entry skipped.")
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
                correlation=correlation
            )
            self.open_positions[symbol] = pos

            logger.info(
                f"\033[92m\033[1m[SNIPER BUY EXECUTED]\033[0m {symbol} @ ${current_price:.6f} | "
                f"Size: {allocated:.2f} USDT | Trigger Leader: {trigger_leader} (r={correlation:.3f}) | "
                f"TP: ${tp_price:.6f} (+2.5%) | SL: ${sl_price:.6f} (-1.2%)"
            )
            return pos

    async def evaluate_and_close_positions(self, latest_prices: Dict[str, float]) -> List[ClosedTradeRecord]:
        """
        Evaluates active positions against live prices. Closes positions that hit TP or SL.
        Prints the exact required formatted terminal report.
        """
        closed_this_tick: List[ClosedTradeRecord] = []
        now = time.time()

        async with self.lock:
            symbols_to_close = []

            for symbol, pos in self.open_positions.items():
                curr_price = latest_prices.get(symbol)
                if not curr_price or curr_price <= 0:
                    continue

                # Check Take Profit
                if curr_price >= pos.take_profit_price:
                    symbols_to_close.append((symbol, curr_price, "TAKE_PROFIT"))
                # Check Stop Loss
                elif curr_price <= pos.stop_loss_price:
                    symbols_to_close.append((symbol, curr_price, "STOP_LOSS"))

            for symbol, exit_price, reason in symbols_to_close:
                pos = self.open_positions.pop(symbol)
                exit_value = pos.coins_amount * exit_price
                pnl_usd = exit_value - pos.position_size_usd
                return_pct = ((exit_price - pos.entry_price) / pos.entry_price) * 100.0

                self.current_balance += exit_value
                # Apply 15-minute cooldown
                self.cooldowns[symbol] = now + self.cooldown_duration

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

                # Format required Arabic/Terminal report:
                # [اسم العملة | سعر الدخول | سعر الخروج | النتيجة % | الرصيد الحالي للمحفظة الوهمية]
                color = "\033[92m" if return_pct >= 0 else "\033[91m"
                bold = "\033[1m"
                reset = "\033[0m"

                report_line = (
                    f"\n{bold}{'='*80}{reset}\n"
                    f"{bold}🔔 [تقرير تنفيذ الصفقة المغلقة / CLOSED TRADE REPORT]{reset}\n"
                    f"{bold}السبب: {reason} | الحجم: {pos.position_size_usd:.2f} USDT{reset}\n"
                    f"{bold}[ اسم العملة: {symbol} | "
                    f"سعر الدخول: ${pos.entry_price:.6f} | "
                    f"سعر الخروج: ${exit_price:.6f} | "
                    f"النتيجة %: {color}{return_pct:+.2f}% ({pnl_usd:+.2f} USDT){reset}{bold} | "
                    f"الرصيد الحالي للمحفظة الوهمية: ${self.current_balance:.2f} USDT ]{reset}\n"
                    f"🕒 فترة التهدئة مفعلة لمدة 15 دقيقة حتى: {datetime.fromtimestamp(self.cooldowns[symbol]).strftime('%H:%M:%S')}\n"
                    f"{bold}{'='*80}{reset}\n"
                )
                sys.stdout.write(report_line)
                sys.stdout.flush()

        return closed_this_tick

    def get_summary_stats(self) -> Dict:
        """Returns portfolio performance metrics."""
        total_pnl = self.current_balance - self.initial_balance
        pnl_pct = (total_pnl / self.initial_balance) * 100.0
        wins = sum(1 for t in self.closed_trades if t.return_pct > 0)
        total_trades = len(self.closed_trades)
        win_rate = (wins / total_trades * 100.0) if total_trades > 0 else 0.0

        return {
            "initial_balance": self.initial_balance,
            "current_balance": self.current_balance,
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
    Identifies behavioral clusters, Leaders, and Followers (r > 0.75).
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
        min_correlation: float = 0.75,
        max_follower_move: float = 0.3
    ) -> List[Tuple[str, float, float]]:
        """
        Returns list of (follower_symbol, correlation, current_1m_move)
        where correlation > 0.75 and follower has lagged behind (move < 0.3%).
        Sorted by highest correlation.
        """
        valid_followers = []
        followers = self.leader_to_followers.get(leader, [])
        for f_sym, corr in followers:
            if corr < min_correlation:
                continue
            f_move = current_1m_moves.get(f_sym, 0.0)
            if f_move < max_follower_move:
                valid_followers.append((f_sym, corr, f_move))

        # Sort descending by correlation strength
        valid_followers.sort(key=lambda x: x[1], reverse=True)
        return valid_followers

class ContextGraphEngine:
    """
    The Brain: Background Swarm Task.
    - Gathers rolling price/volume series.
    - Executes parallel sub-agents every 2 minutes.
    - Builds dynamic Context Graph with Pearson correlation matrix.
    """
    def __init__(self, symbols: List[str], window_size: int = 120):
        self.symbols = symbols
        self.window_size = window_size  # 120 snapshots (~2 hours of 1m or 2m data)
        # Store rolling price & volume history: symbol -> deque of (timestamp, price, volume)
        self.history: Dict[str, deque] = {s: deque(maxlen=self.window_size) for s in self.symbols}
        self.current_graph: ContextGraph = ContextGraph()
        self.lock = asyncio.Lock()
        self.last_update_time: float = 0.0

    def record_snapshot(self, symbol: str, price: float, volume_24h: float):
        """Append price and volume tick into rolling window."""
        if symbol in self.history:
            self.history[symbol].append((time.time(), price, volume_24h))

    async def _sub_agent_analyze_asset(self, symbol: str) -> Dict:
        """
        Sub-Agent worker running asynchronously in parallel.
        Extracts statistical features for a specific asset.
        """
        history_deque = self.history.get(symbol, deque())
        if len(history_deque) < 10:
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
        Computes the complete correlation matrix and synthesizes the Context Graph.
        Simulates parallel swarm execution via asyncio.gather.
        """
        start_time = time.time()
        logger.info("\033[94m[THE BRAIN] Swarm sub-agents launching parallel market scan across 25 assets...\033[0m")

        # Spawn sub-agent tasks concurrently
        tasks = [self._sub_agent_analyze_asset(sym) for sym in self.symbols]
        sub_agent_results = await asyncio.gather(*tasks, return_exceptions=True)

        features: Dict[str, Dict] = {}
        price_dict: Dict[str, List[float]] = {}
        min_len = 999999

        for res in sub_agent_results:
            if isinstance(res, Exception) or not isinstance(res, dict):
                continue
            sym = res["symbol"]
            features[sym] = res
            if len(res["prices"]) >= 5:
                price_dict[sym] = res["prices"]
                if len(res["prices"]) < min_len:
                    min_len = len(res["prices"])

        new_graph = ContextGraph()
        new_graph.timestamp = time.time()

        # If we have enough history to compute correlations
        if len(price_dict) >= 5 and min_len >= 5:
            # Align price series lengths
            aligned_prices = {s: p[-min_len:] for s, p in price_dict.items()}
            df_prices = pd.DataFrame(aligned_prices)

            # Compute Pearson Correlation Matrix based on percentage returns
            df_returns = df_prices.pct_change().dropna()
            if len(df_returns) >= 3:
                corr_matrix = df_returns.corr(method="pearson").fillna(0.0)
            else:
                corr_matrix = df_prices.corr(method="pearson").fillna(0.0)

            new_graph.correlation_matrix = corr_matrix

            # Rank dynamic Leaders based on momentum & volume
            candidate_leaders: List[Tuple[str, float]] = []
            for sym, feat in features.items():
                score = feat["momentum_1m"] * 1.5 + (feat["volume_delta"] * 0.1)
                candidate_leaders.append((sym, score))

            candidate_leaders.sort(key=lambda x: x[1], reverse=True)
            top_leaders = {s for s, _ in candidate_leaders[:6]}  # Top 6 momentum candidates
            new_graph.leaders = top_leaders

            # Construct graph edges for correlated followers (r > 0.75)
            for leader in top_leaders:
                new_graph.leader_to_followers[leader] = []
                if leader in corr_matrix.columns:
                    corrs = corr_matrix[leader]
                    for other_sym, r_val in corrs.items():
                        if other_sym != leader and r_val > 0.75:
                            new_graph.leader_to_followers[leader].append((other_sym, float(r_val)))

            # Populate nodes
            for sym in self.symbols:
                feat = features.get(sym, {})
                new_graph.nodes[sym] = ContextNode(
                    symbol=sym,
                    sector=SECTOR_MAP.get(sym, "General_Crypto"),
                    momentum_1m=feat.get("momentum_1m", 0.0),
                    volume_delta=feat.get("volume_delta", 0.0),
                    is_leader=(sym in top_leaders),
                    followers=new_graph.leader_to_followers.get(sym, [])
                )
        else:
            # Cold-start heuristic graph based on structural sectors & recent momentum
            logger.info("[THE BRAIN] Cold start warmup: Synthesizing baseline sectoral correlation graph...")
            for sym in self.symbols:
                sector = SECTOR_MAP.get(sym, "General_Crypto")
                feat = features.get(sym, {})
                # Find peers in same sector
                peers = [(other, 0.85) for other, sec in SECTOR_MAP.items() if sec == sector and other != sym]
                new_graph.nodes[sym] = ContextNode(
                    symbol=sym,
                    sector=sector,
                    momentum_1m=feat.get("momentum_1m", 0.0),
                    volume_delta=feat.get("volume_delta", 0.0),
                    is_leader=(sym in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]),
                    followers=peers
                )
                if sym in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]:
                    new_graph.leaders.add(sym)
                    new_graph.leader_to_followers[sym] = peers

        async with self.lock:
            self.current_graph = new_graph
            self.last_update_time = time.time()

        elapsed = time.time() - start_time
        logger.info(
            f"\033[92m[THE BRAIN UPDATED]\033[0m Context Graph built in {elapsed:.2f}s | "
            f"Identified Leaders: {list(new_graph.leaders)} | "
            f"High-Correlation Edges (r > 0.75): {sum(len(f) for f in new_graph.leader_to_followers.values())}"
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
    BINANCE_WS_URL = "wss://stream.binance.com:9443/stream?streams="

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

    def _calculate_1m_move(self, symbol: str) -> float:
        """Calculates exact 1-minute percentage price delta from tick buffer."""
        dq = self.price_history_1m.get(symbol)
        if not dq or len(dq) < 2:
            return 0.0

        now_ts, p_now = dq[-1]
        # Search backward for tick closest to 60 seconds ago
        p_old = dq[0][1]
        for ts, p in dq:
            if now_ts - ts >= 60.0:
                p_old = p
            else:
                break

        if p_old <= 0:
            return 0.0
        return ((p_now - p_old) / p_old) * 100.0

    async def _handle_price_tick(self, symbol: str, current_price: float, volume_24h: float):
        """Processes an incoming tick for an asset."""
        now = time.time()
        self.latest_prices[symbol] = current_price
        self.latest_volumes_24h[symbol] = volume_24h

        # Update 1m buffer and brain buffer
        self.price_history_1m[symbol].append((now, current_price))
        self.brain.record_snapshot(symbol, current_price, volume_24h)

        # 1. Manage existing positions (TP / SL evaluation)
        await self.wallet.evaluate_and_close_positions(self.latest_prices)

        # 2. Compute 1-minute move for current symbol
        move_1m = self._calculate_1m_move(symbol)

        # 3. Check if current symbol is a Leader experiencing a sudden surge (> 1.5% in 1 minute)
        if move_1m >= 1.5:
            await self._process_leader_surge_signal(symbol, move_1m)

    async def _process_leader_surge_signal(self, leader_symbol: str, leader_move_1m: float):
        """
        Executed when a Leader coin breaks out > 1.5% in 1 minute.
        Queries the in-memory Context Graph for lagging followers.
        """
        graph = await self.brain.get_latest_graph()

        # Check if symbol is registered as leader or acting as leading asset
        is_leader = (leader_symbol in graph.leaders) or (leader_move_1m >= 1.8)
        if not is_leader:
            return

        logger.info(
            f"\033[93m\033[1m[LEADER SURGE DETECTED]\033[0m {leader_symbol} surged "
            f"\033[92m+{leader_move_1m:.2f}%\033[0m in 60s! Scanning Context Graph for lagging followers..."
        )

        # Build current 1m moves map for all assets
        current_1m_moves = {s: self._calculate_1m_move(s) for s in self.symbols}

        # Query Context Graph for correlated followers (r > 0.75, move < 0.3%)
        candidates = graph.get_lagging_followers_for_leader(
            leader=leader_symbol,
            current_1m_moves=current_1m_moves,
            min_correlation=0.75,
            max_follower_move=0.3
        )

        if not candidates:
            # If no graph entry found, inspect sector peers
            sector = SECTOR_MAP.get(leader_symbol)
            if sector:
                for s in self.symbols:
                    if s != leader_symbol and SECTOR_MAP.get(s) == sector:
                        s_move = current_1m_moves.get(s, 0.0)
                        if s_move < 0.3:
                            candidates.append((s, 0.80, s_move))

        if not candidates:
            logger.info(f"[SNIPER SCAN] No eligible lagging followers found for {leader_symbol} (all moved or r < 0.75).")
            return

        # Target the top lagging follower with highest correlation
        target_symbol, corr, target_move = candidates[0]

        # Verify Execution constraints
        is_cooling, rem_time = self.wallet.is_in_cooldown(target_symbol)
        if is_cooling:
            logger.info(f"[SNIPER SKIP] Target {target_symbol} is in cooldown ({rem_time:.1f}s left).")
            return

        if self.wallet.has_open_position(target_symbol):
            return

        target_price = self.latest_prices.get(target_symbol)
        if not target_price or target_price <= 0:
            return

        # Execute Sniper Entry via Paper Wallet
        logger.info(
            f"\033[96m[SNIPER LOCK-ON]\033[0m Target: {target_symbol} | Lagging at {target_move:+.2f}% | "
            f"Correlated with Leader {leader_symbol} (r={corr:.2f})"
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
        Handles auto-reconnects with exponential backoff.
        """
        streams = [f"{s.lower()}@miniTicker" for s in self.symbols]
        combined_url = self.BINANCE_WS_URL + "/".join(streams)
        backoff_seconds = 2.0

        logger.info(f"[EXECUTIONER] Connecting to Binance Public WebSocket ({len(self.symbols)} streams)...")

        while self.running:
            try:
                async with websockets.connect(
                    combined_url,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=10
                ) as ws:
                    logger.info("\033[92m\033[1m[WEBSOCKET CONNECTED]\033[0m Successfully streaming real-time ticks from Binance.")
                    backoff_seconds = 2.0  # Reset backoff on successful connect

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
                logger.warning(
                    f"\033[91m[WEBSOCKET ERROR]\033[0m Connection dropped ({e}). "
                    f"Reconnecting in {backoff_seconds:.1f}s..."
                )
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 1.5, 30.0)

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
        self.brain = ContextGraphEngine(symbols=self.symbols, window_size=120)
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
                stats = self.wallet.get_summary_stats()
                now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

                banner = (
                    f"\n\033[90m{'─'*80}\033[0m\n"
                    f"\033[1m📊 [STATUS UPDATE - {now_str}]\033[0m\n"
                    f"  💼 Virtual Balance: \033[92m${stats['current_balance']:.2f} USDT\033[0m | "
                    f"PnL: \033[92m{stats['total_pnl_usd']:+.2f} USDT ({stats['total_pnl_pct']:+.2f}%)\033[0m | "
                    f"Win Rate: {stats['win_rate']:.1f}% ({stats['closed_trades_count']} trades)\n"
                    f"  🎯 Open Positions ({stats['open_positions_count']}): "
                    f"{list(self.wallet.open_positions.keys()) if self.wallet.open_positions else 'None'}\n"
                    f"\033[90m{'─'*80}\033[0m\n"
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
        print(f"\033[96m\033[1m{banner}\033[0m")
        print("\033[1m[*] Operating System:\033[0m Kali Linux / Linux x86_64")
        print(f"\033[1m[*] Target Universe:\033[0m {len(self.symbols)} Top Liquidity Pairs")
        print(f"\033[1m[*] Initial Paper Balance:\033[0m {self.wallet.initial_balance:,.2f} USDT")
        print(f"\033[1m[*] Trade Allocation:\033[0m {self.wallet.position_size_usd:,.2f} USDT (or 5% of balance)")
        print(f"\033[1m[*] Risk Rules:\033[0m Take Profit: +2.5% | Stop Loss: -1.2% | Cooldown: 15 Minutes")
        print(f"\033[1m[*] Context Graph:\033[0m Async Swarm Cycle: Every 2 Minutes | Leader Threshold: >1.5%/1m | Correlation: >0.75")
        print("\033[93m[*] Press Ctrl+C at any time to gracefully shutdown.\033[0m\n")

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
        print("\n\033[95m\033[1m" + "="*80)
        print("                  SESSION SUMMARY REPORT / تقرير ختام الجلسة")
        print("="*80 + "\033[0m")
        print(f"  • الرصيد الابتدائي (Initial Balance):   ${stats['initial_balance']:,.2f} USDT")
        print(f"  • الرصيد النهائي (Final Balance):       ${stats['current_balance']:,.2f} USDT")
        color = "\033[92m" if stats['total_pnl_usd'] >= 0 else "\033[91m"
        print(f"  • صافي الربح/الخسارة (Total PnL):      {color}${stats['total_pnl_usd']:+,.2f} USDT ({stats['total_pnl_pct']:+.2f}%)\033[0m")
        print(f"  • عدد الصفقات المنفذة (Total Trades):  {stats['closed_trades_count']}")
        print(f"  • نسبة النجاح (Win Rate):              {stats['win_rate']:.1f}%")
        print(f"  • الصفقات المفتوحة المتبقية:          {stats['open_positions_count']}")
        print("\033[95m\033[1m" + "="*80 + "\033[0m\n")

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
        logger.info("\n\033[93m[!] Keyboard interrupt received (Ctrl+C). Shutting down bot gracefully...\033[0m")
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
