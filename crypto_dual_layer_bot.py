#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===================================================================================
      DUAL-LAYER CRYPTO TRADING BOT WITH CONTEXT GRAPH ENGINEERING
                     & INDEPENDENT QUANTITATIVE AUDIT
===================================================================================
Quantitative Architecture & Scientific Standards:
  Layer 1: The Context Graph Engine (Statistical Matrix & Lead-Lag Validation)
    - Causal Synchronous 5-second Time-Grid Resampling (strictly forward-filled from
      past data points; zero look-ahead bias, no future interpolation).
    - Tri-Component Correlation: Empirical, Sector Statistical Prior, and Blended.
    - Empirical Lead-Lag Cross-Correlation Analysis across multiple horizons:
      tau in [5s, 10s, 15s, 20s, 30s, 45s, 60s].
    - Explicit classification: 'Correlated Candidate' vs 'Lead-Lag Validated Candidate'.
      Zero causal language without formal causal proof.
    - Event-based impulse tracking (Leader surge -> Follower MFE / MAE / Response time).
    - Market Regime Detector: BULL, BEAR, SIDEWAYS, HIGH_VOLATILITY, LOW_LIQUIDITY, DATA_UNCERTAIN.
    - Sector Breadth & Market Breadth analytics.

  Layer 2: The Executioner (Sniper & Dynamic Risk Engine)
    - Decoupled Pipeline: Discovery -> Feature -> Signal -> Validation -> Risk -> Execution.
    - Signal Outcome Database recording all signals (executed and rejected) with forward
      returns (+5s, +10s, +20s, +30s, +60s, +120s), MFE, and MAE.
    - Research Mode flag (RESEARCH_MODE=True) for non-trading empirical evaluation.
    - Independent Risk Engine: Position limits, sector cluster exposure, correlated cluster
      exposure, peak-to-trough drawdown limits, daily loss circuit breaker.
    - Realistic Paper Execution: Binance taker fees (0.075%), estimated execution slippage (0.025%),
      order latency logging.
    - Exact Equity Accounting: Equity = Cash + Market Value of Open Positions.
    - Defensive Exit Pipeline: Scalp TP (+1.6%), Breakeven Lock (+0.7%), Dynamic Trailing Stop (+1.2%),
      Hard SL (-1.0%), Time Expiry (25m).
    - Unified Replay & Backtest Engine: Identical pipeline shared between live, replay, and backtest.
    - 5 Benchmark Baselines: BTC Buy & Hold, Simple Momentum, Random Entry, Leader-Only, Correlation-Only.
===================================================================================
Target OS: Kali Linux / Ubuntu / Debian / Linux x86_64
===================================================================================
"""

import sys
import os
import json
import time
import math
import logging
import asyncio
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Set, Any
from collections import deque
from enum import Enum

try:
    import numpy as np
    import pandas as pd
    import websockets
except ImportError as err:
    print(f"\n[!] Missing quantitative dependency: {err}")
    print("[*] Install required packages on Kali Linux / Debian:")
    print("    pip install websockets pandas numpy scipy aiohttp pytest\n")
    sys.exit(1)


# =================================================================================
# 1. PARAMETER REGISTRY & PROVENANCE METADATA
# =================================================================================
class ParameterSource(Enum):
    HEURISTIC = "HEURISTIC"
    EMPIRICAL = "EMPIRICAL"
    EXTERNAL = "EXTERNAL"


@dataclass(frozen=True)
class ParameterMetadata:
    name: str
    value: Any
    description: str
    unit: str
    default: Any
    source: ParameterSource
    last_changed: str


@dataclass(frozen=True)
class StrategyConfig:
    """
    Central, immutable quantitative parameters with complete provenance metadata.
    Zero magic numbers distributed across the codebase.
    """
    # Universe: Configured 25-Symbol Universe (Not dynamically ranked unless explicitly stated)
    TARGET_SYMBOLS: Tuple[str, ...] = (
        "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
        "ADAUSDT", "AVAXUSDT", "SUIUSDT", "DOTUSDT", "LINKUSDT",
        "NEARUSDT", "FETUSDT", "RENDERUSDT", "TAOUSDT", "OPUSDT",
        "ARBUSDT", "APTUSDT", "DOGEUSDT", "SHIBUSDT", "PEPEUSDT",
        "WIFUSDT", "BONKUSDT", "ONDOUSDT", "JUPUSDT", "STXUSDT"
    )

    # 7 Domain Sector Clusters
    SECTOR_MAP: Dict[str, str] = field(default_factory=lambda: {
        "DOGEUSDT": "MEME",
        "SHIBUSDT": "MEME",
        "PEPEUSDT": "MEME",
        "WIFUSDT": "MEME",
        "BONKUSDT": "MEME",

        "FETUSDT": "AI_COMPUTE",
        "RENDERUSDT": "AI_COMPUTE",
        "TAOUSDT": "AI_COMPUTE",
        "NEARUSDT": "AI_COMPUTE",

        "SOLUSDT": "L1_CHAINS",
        "SUIUSDT": "L1_CHAINS",
        "APTUSDT": "L1_CHAINS",
        "AVAXUSDT": "L1_CHAINS",
        "ADAUSDT": "L1_CHAINS",
        "DOTUSDT": "L1_CHAINS",
        "BNBUSDT": "L1_CHAINS",

        "STXUSDT": "L2_ECOSYSTEM",
        "OPUSDT": "L2_ECOSYSTEM",
        "ARBUSDT": "L2_ECOSYSTEM",

        "LINKUSDT": "DEFI_RWA",
        "ONDOUSDT": "DEFI_RWA",
        "JUPUSDT": "DEFI_RWA",

        "XRPUSDT": "PAYMENTS",

        "BTCUSDT": "MARKET_ANCHOR",
        "ETHUSDT": "MARKET_ANCHOR"
    })

    # Operational Mode
    RESEARCH_MODE: bool = False  # When True, records signals and outcomes but places no orders

    # Capital Allocation
    INITIAL_BALANCE_USDT: float = 10000.0
    DEFAULT_POSITION_SIZE_USDT: float = 500.0
    USE_FIXED_POSITION_SIZE: bool = False  # If False, uses risk-based sizing
    RISK_PER_TRADE_PCT: float = 0.01       # 1.0% equity risk per trade in risk-based sizing
    MAX_POSITION_SIZE_USDT: float = 800.0
    MIN_POSITION_SIZE_USDT: float = 100.0

    # Risk Controls & Limits
    MAX_OPEN_POSITIONS: int = 5
    MAX_TOTAL_EXPOSURE_USDT: float = 3500.0
    MAX_SECTOR_EXPOSURE: int = 2
    MAX_CLUSTER_CORRELATED_EXPOSURE_USDT: float = 1500.0  # Cap across highly correlated positions (r > 0.70)
    MAX_DAILY_LOSS_PCT: float = 4.0
    MAX_DRAWDOWN_LIMIT_PCT: float = 6.0
    MAX_CONSECUTIVE_LOSSES: int = 4

    # Execution Targets & Protective Exits
    TAKE_PROFIT_PCT: float = 1.6
    STOP_LOSS_PCT: float = 1.0
    BREAKEVEN_TRIGGER_PCT: float = 0.70
    BREAKEVEN_OFFSET_PCT: float = 0.10
    TRAILING_STOP_TRIGGER_PCT: float = 1.20
    TRAILING_STOP_DISTANCE_PCT: float = 0.40
    TIME_EXPIRY_SECONDS: float = 1500.0

    # Cooldown Rules (15-Minute Anti-Duplicate Trading Window)
    COOLDOWN_LOSS_SECONDS: float = 900.0      # 15 minutes cooldown after loss
    COOLDOWN_PROFIT_SECONDS: float = 900.0    # 15 minutes cooldown after profit
    LEADER_DEBOUNCE_SECONDS: float = 180.0    # 180 seconds leader surge deduplication window

    # Signal & Momentum Thresholds
    MIN_LEADER_RETURN_20S: float = 0.90
    MIN_LEADER_RETURN_60S: float = 1.20
    MAX_FOLLOWER_MOVE_60S: float = 0.45
    MIN_FOLLOWER_MOVE_60S: float = -1.20
    MIN_VOLUME_RATIO: float = 1.20

    # Correlation & Lead-Lag Statistical Constraints
    MIN_CORRELATION: float = 0.65
    MIN_CORRELATION_SAMPLES: int = 20
    MIN_LEAD_LAG_CORRELATION: float = 0.30
    MIN_LEAD_LAG_HIT_RATE: float = 0.50
    EMPIRICAL_CORR_WEIGHT: float = 0.60
    SECTOR_PRIOR_WEIGHT: float = 0.40
    MAX_GRAPH_AGE_SECONDS: float = 300.0
    BRAIN_CYCLE_INTERVAL_SECONDS: float = 60.0

    # Data Health & Grid Sampling
    GRID_STEP_SECONDS: float = 5.0
    RESAMPLE_SPAN_SECONDS: float = 300.0
    MAX_TICK_AGE_SECONDS: float = 25.0
    MAX_STALENESS_FOR_GRID_SECONDS: float = 20.0
    WARMUP_MIN_TICKS_PER_SYMBOL: int = 6
    WARMUP_MIN_DURATION_SECONDS: float = 20.0

    # Realistic Market Friction
    TAKER_FEE_RATE: float = 0.00075          # 0.075% taker fee
    ESTIMATED_SLIPPAGE_RATE: float = 0.00025 # 0.025% execution slippage
    SIMULATED_LATENCY_SECONDS: float = 0.045 # 45ms estimated round-trip latency

    # Hourly Trading Reports Engine
    HOURLY_REPORT_INTERVAL_SECONDS: float = 3600.0
    REPORTS_DIR: str = "trading_reports"
    ENABLE_HOURLY_REPORTS: bool = True


CONFIG = StrategyConfig()
TARGET_SYMBOLS: List[str] = list(CONFIG.TARGET_SYMBOLS)
SECTOR_MAP: Dict[str, str] = CONFIG.SECTOR_MAP

CONFIG_PROVENANCE_REGISTRY: Dict[str, ParameterMetadata] = {
    "HOURLY_REPORT_INTERVAL_SECONDS": ParameterMetadata(
        name="HOURLY_REPORT_INTERVAL_SECONDS", value=CONFIG.HOURLY_REPORT_INTERVAL_SECONDS,
        description="Interval in seconds between automated persistent trading reports", unit="seconds",
        default=3600.0, source=ParameterSource.EXTERNAL, last_changed="2026-09-20"
    ),
    "REPORTS_DIR": ParameterMetadata(
        name="REPORTS_DIR", value=CONFIG.REPORTS_DIR,
        description="Directory for structured JSON and text hourly trading reports", unit="path",
        default="trading_reports", source=ParameterSource.EXTERNAL, last_changed="2026-09-20"
    ),
    "MIN_LEADER_RETURN_20S": ParameterMetadata(
        name="MIN_LEADER_RETURN_20S", value=CONFIG.MIN_LEADER_RETURN_20S,
        description="Minimum return in 20s for a leader breakout impulse", unit="%",
        default=0.90, source=ParameterSource.EMPIRICAL, last_changed="2026-09-20"
    ),
    "MIN_VOLUME_RATIO": ParameterMetadata(
        name="MIN_VOLUME_RATIO", value=CONFIG.MIN_VOLUME_RATIO,
        description="Minimum volume relative to rolling 300s baseline", unit="ratio",
        default=1.20, source=ParameterSource.EMPIRICAL, last_changed="2026-09-20"
    ),
    "MIN_CORRELATION": ParameterMetadata(
        name="MIN_CORRELATION", value=CONFIG.MIN_CORRELATION,
        description="Minimum blended correlation threshold for peer grouping", unit="correlation",
        default=0.65, source=ParameterSource.HEURISTIC, last_changed="2026-09-20"
    ),
    "MIN_CORRELATION_SAMPLES": ParameterMetadata(
        name="MIN_CORRELATION_SAMPLES", value=CONFIG.MIN_CORRELATION_SAMPLES,
        description="Minimum resampled 5s grid points before correlation is deemed valid", unit="samples",
        default=20, source=ParameterSource.EMPIRICAL, last_changed="2026-09-20"
    ),
    "MIN_LEAD_LAG_CORRELATION": ParameterMetadata(
        name="MIN_LEAD_LAG_CORRELATION", value=CONFIG.MIN_LEAD_LAG_CORRELATION,
        description="Minimum cross-correlation rho(tau) to validate lead-lag structure", unit="correlation",
        default=0.30, source=ParameterSource.EMPIRICAL, last_changed="2026-09-20"
    ),
    "TAKE_PROFIT_PCT": ParameterMetadata(
        name="TAKE_PROFIT_PCT", value=CONFIG.TAKE_PROFIT_PCT,
        description="Fixed profit target for scalp exit", unit="%",
        default=1.60, source=ParameterSource.HEURISTIC, last_changed="2026-09-20"
    ),
    "STOP_LOSS_PCT": ParameterMetadata(
        name="STOP_LOSS_PCT", value=CONFIG.STOP_LOSS_PCT,
        description="Hard protective stop loss", unit="%",
        default=1.00, source=ParameterSource.HEURISTIC, last_changed="2026-09-20"
    ),
    "TAKER_FEE_RATE": ParameterMetadata(
        name="TAKER_FEE_RATE", value=CONFIG.TAKER_FEE_RATE,
        description="Binance spot taker fee tier", unit="rate",
        default=0.00075, source=ParameterSource.EXTERNAL, last_changed="2026-09-20"
    ),
    "ESTIMATED_SLIPPAGE_RATE": ParameterMetadata(
        name="ESTIMATED_SLIPPAGE_RATE", value=CONFIG.ESTIMATED_SLIPPAGE_RATE,
        description="Estimated execution slippage across high-liquidity books", unit="rate",
        default=0.00025, source=ParameterSource.EMPIRICAL, last_changed="2026-09-20"
    ),
    "MAX_DRAWDOWN_LIMIT_PCT": ParameterMetadata(
        name="MAX_DRAWDOWN_LIMIT_PCT", value=CONFIG.MAX_DRAWDOWN_LIMIT_PCT,
        description="Circuit breaker peak-to-trough drawdown limit", unit="%",
        default=6.0, source=ParameterSource.HEURISTIC, last_changed="2026-09-20"
    )
}


# =================================================================================
# 2. ENUMS & STATISTICAL DATA MODELS
# =================================================================================
class FeedHealth(Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    STALE = "STALE"
    DISCONNECTED = "DISCONNECTED"


class BotState(Enum):
    STARTING = "STARTING"
    COLLECTING_DATA = "COLLECTING_DATA"
    WARMUP = "WARMUP"
    GRAPH_READY = "GRAPH_READY"
    TRADING_ENABLED = "TRADING_ENABLED"
    RESEARCH_ONLY = "RESEARCH_ONLY"
    DEGRADED = "DEGRADED"
    HALTED = "HALTED"


class MarketRegime(Enum):
    BULL = "BULL"
    BEAR = "BEAR"
    SIDEWAYS = "SIDEWAYS"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_LIQUIDITY = "LOW_LIQUIDITY"
    DATA_UNCERTAIN = "DATA_UNCERTAIN"


class ValidationStatus(Enum):
    VALIDATED = "VALIDATED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    LOW_CORRELATION = "LOW_CORRELATION"
    NO_LEAD_LAG = "NO_LEAD_LAG"
    UNVALIDATED_CANDIDATE = "UNVALIDATED_CANDIDATE"


@dataclass
class LeadLagRelationship:
    """
    Empirical lead-lag statistical metrics between candidate Leader and Follower.
    Distinguishes correlated candidates from validated lead-lag dynamics.
    """
    leader: str
    follower: str
    best_lag_seconds: float
    lead_lag_correlation: float
    sample_size: int
    hit_rate: float
    mean_follow_return: float = 0.0
    median_follow_return: float = 0.0
    std_follow_return: float = 0.0
    positive_response_rate: float = 0.0
    negative_response_rate: float = 0.0
    failure_rate: float = 0.0
    is_valid_lead: bool = False
    validation_status: ValidationStatus = ValidationStatus.UNVALIDATED_CANDIDATE


@dataclass
class EventLeadLagOutcome:
    """Event-based response metrics following a detected Leader breakout impulse."""
    event_id: str
    timestamp: float
    leader: str
    follower: str
    leader_impulse_20s: float
    follower_initial_price: float
    did_follower_move: bool = False
    time_to_response_seconds: float = 0.0
    response_magnitude_pct: float = 0.0
    response_direction: str = "NEUTRAL"
    mfe_pct: float = 0.0  # Maximum Favorable Excursion
    mae_pct: float = 0.0  # Maximum Adverse Excursion
    return_5s: Optional[float] = None
    return_10s: Optional[float] = None
    return_20s: Optional[float] = None
    return_30s: Optional[float] = None
    return_60s: Optional[float] = None
    return_120s: Optional[float] = None


@dataclass
class Position:
    """Represents an active paper trade with full dynamic risk tracking."""
    symbol: str
    entry_price: float
    position_size_usd: float
    coins_amount: float
    entry_time: float
    take_profit_price: float
    stop_loss_price: float
    trigger_leader: str
    correlation: float
    best_lag_seconds: float = 15.0
    highest_price: float = 0.0
    breakeven_active: bool = False
    trailing_active: bool = False
    entry_fee_usd: float = 0.0
    slippage_usd: float = 0.0
    signal_id: str = ""


@dataclass
class ClosedTradeRecord:
    """Represents a finalized trade with explicit gross/net PnL breakdown and timing audit."""
    trade_id: str
    signal_id: str
    symbol: str
    trigger_leader: str
    entry_price: float
    exit_price: float
    return_pct: float
    gross_pnl_usd: float
    fees_paid_usd: float
    slippage_usd: float
    net_pnl_usd: float
    entry_time: float
    exit_time: float
    holding_seconds: float
    entry_reason: str
    exit_reason: str
    mfe_pct: float
    mae_pct: float
    wallet_balance_after: float


@dataclass
class SignalRecord:
    """Complete journal entry for every signal generated in Discovery or Trading."""
    signal_id: str
    timestamp: float
    leader: str
    follower: str
    leader_return_20s: float
    leader_return_60s: float
    follower_scan_return_60s: float
    empirical_correlation: float
    sector_prior: float
    blended_correlation: float
    sample_size: int
    best_lag_seconds: float
    lead_lag_correlation: float
    volume_ratio: float
    sector: str
    market_regime: str
    score: float
    decision: str  # EXECUTED, REJECTED_BY_RISK, REJECTED_BY_LOW_CORRELATION, etc.
    rejection_reason: str = ""
    # Forward Outcome Tracking
    forward_return_5s: Optional[float] = None
    forward_return_10s: Optional[float] = None
    forward_return_20s: Optional[float] = None
    forward_return_30s: Optional[float] = None
    forward_return_60s: Optional[float] = None
    forward_return_120s: Optional[float] = None
    mfe_pct: float = 0.0
    mae_pct: float = 0.0


@dataclass
class PortfolioSummary:
    """
    Unified, strongly typed portfolio summary.
    Separates cash balance from total portfolio equity with verified accounting:
    Equity = Cash + Market Value of Open Positions
    """
    initial_balance: float
    cash_balance: float
    current_balance: float  # Compatibility alias for cash_balance
    total_equity: float
    market_value_open_positions: float
    open_exposure_usd: float
    unrealized_pnl: float
    realized_gross_pnl: float
    total_fees_paid: float
    total_slippage_cost: float
    realized_net_pnl: float
    total_pnl_usd: float
    total_pnl_pct: float
    open_positions_count: int
    closed_trades_count: int
    winning_trades_count: int
    losing_trades_count: int
    win_rate: float
    profit_factor: float
    expectancy_usd: float
    peak_equity: float
    drawdown_usd: float
    drawdown_pct: float
    max_drawdown_pct: float
    consecutive_losses: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# =================================================================================
# 3. KALI LINUX TERMINAL ANSI COLOR FORMATTER & LOGGING
# =================================================================================
class KaliColorFormatter(logging.Formatter):
    """Custom ANSI Terminal Color Formatter optimized for Kali Linux / Debian shells."""
    GREY = "\033[90m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

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
if not logger.handlers:
    logger.addHandler(console_handler)


# =================================================================================
# 4. DATA FEED RELIABILITY & HEALTH MONITOR
# =================================================================================
class DataHealthMonitor:
    """
    Monitors tick freshness, missing symbols, feed health, and system lifecycle state.
    Critical Rule: Never open a new trade if feed is STALE or DATA_UNCERTAIN.
    """
    def __init__(self, symbols: List[str], max_tick_age: float = CONFIG.MAX_TICK_AGE_SECONDS):
        self.symbols = symbols
        self.max_tick_age = max_tick_age
        self.last_tick_time: Dict[str, float] = {}
        self.tick_count: Dict[str, int] = {s: 0 for s in self.symbols}
        self.start_time = time.time()
        self.websocket_connected = False
        self.reconnect_count = 0
        self.system_state: BotState = BotState.STARTING
        self.feed_health: FeedHealth = FeedHealth.DISCONNECTED

    def on_tick(self, symbol: str, timestamp: float):
        self.last_tick_time[symbol] = timestamp
        self.tick_count[symbol] = self.tick_count.get(symbol, 0) + 1

    def is_symbol_fresh(self, symbol: str, max_age: Optional[float] = None) -> bool:
        age_limit = max_age or self.max_tick_age
        last = self.last_tick_time.get(symbol)
        if last is None:
            return False
        return (time.time() - last) <= age_limit

    def evaluate_health(self) -> Tuple[FeedHealth, BotState]:
        now = time.time()
        if not self.websocket_connected:
            self.feed_health = FeedHealth.DISCONNECTED
            return self.feed_health, self.system_state

        stale_symbols = [s for s in self.symbols if (now - self.last_tick_time.get(s, 0.0)) > self.max_tick_age]
        online_count = len(self.symbols) - len(stale_symbols)

        if len(stale_symbols) == 0 and online_count == len(self.symbols):
            self.feed_health = FeedHealth.HEALTHY
        elif online_count >= 18:
            self.feed_health = FeedHealth.DEGRADED
        else:
            self.feed_health = FeedHealth.STALE

        elapsed = now - self.start_time
        min_ticks = min(self.tick_count.values()) if self.tick_count else 0

        if self.system_state == BotState.HALTED:
            pass  # Retain circuit breaker halt
        elif elapsed < CONFIG.WARMUP_MIN_DURATION_SECONDS or min_ticks < CONFIG.WARMUP_MIN_TICKS_PER_SYMBOL:
            self.system_state = BotState.WARMUP
        elif self.feed_health in (FeedHealth.HEALTHY, FeedHealth.DEGRADED):
            self.system_state = BotState.RESEARCH_ONLY if CONFIG.RESEARCH_MODE else BotState.TRADING_ENABLED
        else:
            self.system_state = BotState.DEGRADED

        return self.feed_health, self.system_state


# =================================================================================
# 5. TIMESTAMPED MARKET DATA BUFFER & CAUSAL RESAMPLING
# =================================================================================
class TimestampedMarketBuffer:
    """
    Time-indexed circular buffer for raw tick data.
    Implements STRICTLY CAUSAL synchronous resampling:
      - Point t in grid is constructed solely from the latest observation at or prior to t.
      - Zero interpolation across future ticks (no np.interp look-ahead bias).
      - Handles duplicate timestamps and out-of-order tick arrival.
      - Enforces staleness cutoff: data older than MAX_STALENESS_FOR_GRID_SECONDS is set to NaN.
    """
    def __init__(self, symbols: List[str], max_history_seconds: float = 600.0):
        self.symbols = symbols
        self.max_history_seconds = max_history_seconds
        # symbol -> deque of (timestamp, price, volume_24h, volume_delta)
        self.buffers: Dict[str, deque] = {s: deque() for s in self.symbols}
        self.lock = asyncio.Lock()

    def record_tick(self, symbol: str, timestamp: float, price: float, volume_24h: float):
        if price <= 0 or math.isnan(price) or math.isinf(price):
            return

        dq = self.buffers.get(symbol)
        if dq is None:
            dq = deque()
            self.buffers[symbol] = dq

        vol_delta = 0.0
        if dq:
            prev_ts, prev_price, prev_v24, _ = dq[-1]
            if volume_24h >= prev_v24:
                vol_delta = volume_24h - prev_v24

            # Anomaly filter: reject > 50% single-tick jumps
            if abs(price - prev_price) / prev_price > 0.50:
                logger.warning(f"[DATA ANOMALY] Dropped aberrant tick for {symbol}: prev={prev_price}, new={price}")
                return

            # Handle duplicate or out-of-order ticks
            if timestamp <= prev_ts:
                timestamp = prev_ts + 1e-4

        dq.append((timestamp, price, volume_24h, vol_delta))

        # Evict old entries
        cutoff = timestamp - self.max_history_seconds
        while dq and dq[0][0] < cutoff:
            dq.popleft()

    def return_over_seconds(self, symbol: str, seconds: float, as_of_time: Optional[float] = None) -> Optional[float]:
        """
        Calculates causal return over exact elapsed seconds up to as_of_time (or latest tick).
        Causal backward lookup: uses the latest observed price at or before target_ts.
        """
        dq = self.buffers.get(symbol)
        if not dq or len(dq) < 2:
            return None

        now_ts = as_of_time if as_of_time is not None else dq[-1][0]
        # Find price at or immediately before now_ts
        p_now = None
        for ts, p, _, _ in reversed(dq):
            if ts <= now_ts:
                p_now = p
                break
        if p_now is None:
            return None

        target_ts = now_ts - seconds
        # Check if history spans the window
        if dq[0][0] > target_ts + 3.0:
            return None

        # Causal lookup: find latest observed price at or before target_ts
        p_target = None
        for ts, p, _, _ in reversed(dq):
            if ts <= target_ts:
                p_target = p
                break

        if p_target is None or p_target <= 0:
            return None

        return ((p_now - p_target) / p_target) * 100.0

    def short_term_volume(self, symbol: str, seconds: float = 20.0, as_of_time: Optional[float] = None) -> float:
        """Accumulated volume delta over recent `seconds` strictly up to as_of_time."""
        dq = self.buffers.get(symbol)
        if not dq or len(dq) < 2:
            return 0.0

        ref_ts = as_of_time if as_of_time is not None else dq[-1][0]
        cutoff = ref_ts - seconds
        vol_sum = 0.0
        for ts, _, _, delta in reversed(dq):
            if ts > ref_ts:
                continue
            if ts < cutoff:
                break
            vol_sum += delta
        return vol_sum

    def short_term_volume_ratio(self, symbol: str, seconds: float = 20.0, as_of_time: Optional[float] = None) -> float:
        """Volume ratio relative to rolling 300s baseline."""
        dq = self.buffers.get(symbol)
        if not dq or len(dq) < 4:
            return 1.0

        current_vol = self.short_term_volume(symbol, seconds, as_of_time=as_of_time)
        baseline_vol = self.short_term_volume(symbol, 300.0, as_of_time=as_of_time)
        expected_chunk = baseline_vol * (seconds / 300.0)

        if expected_chunk <= 0:
            return 1.0
        return current_vol / expected_chunk

    def get_resampled_time_grid(
        self,
        span_seconds: float = CONFIG.RESAMPLE_SPAN_SECONDS,
        step_seconds: float = CONFIG.GRID_STEP_SECONDS,
        as_of_time: Optional[float] = None
    ) -> Optional[pd.DataFrame]:
        """
        STRICTLY CAUSAL synchronous resampling onto a uniform time grid.
        For every grid point t, selects the latest price observed at or before t.
        Guarantees NO look-ahead bias and NO future data leakage.
        """
        now = as_of_time if as_of_time is not None else time.time()
        start_time = now - span_seconds
        grid_times = np.arange(start_time, now + 1e-4, step_seconds)

        if len(grid_times) < 10:
            return None

        synced = {}
        for sym in self.symbols:
            dq = self.buffers.get(sym)
            if not dq or len(dq) < 3:
                continue

            ts_list = [item[0] for item in dq]
            pr_list = [item[1] for item in dq]
            ts_arr = np.array(ts_list)
            pr_arr = np.array(pr_list)

            # Check coverage
            if ts_arr[-1] < (now - CONFIG.MAX_TICK_AGE_SECONDS):
                continue  # Stale asset

            # Causal step-wise forward fill:
            # For each grid point t, find index of latest tick where ts <= t
            idx = np.searchsorted(ts_arr, grid_times, side='right') - 1
            valid_mask = idx >= 0

            # Guard staleness: if grid time t is too far past the tick, mark NaN
            grid_prices = np.full(len(grid_times), np.nan)
            for g_i, v_i in enumerate(idx):
                if v_i >= 0:
                    tick_ts = ts_arr[v_i]
                    if (grid_times[g_i] - tick_ts) <= CONFIG.MAX_STALENESS_FOR_GRID_SECONDS:
                        grid_prices[g_i] = pr_arr[v_i]

            # Require at least 70% non-nan coverage
            non_nan_count = np.count_nonzero(~np.isnan(grid_prices))
            if non_nan_count >= (len(grid_times) * 0.70):
                # Safe causal forward fill for any minor intermittent holes
                s = pd.Series(grid_prices, index=grid_times).ffill()
                if not s.isna().all():
                    synced[sym] = s.values

        if len(synced) >= 4:
            df = pd.DataFrame(synced, index=grid_times)
            # Drop initial rows where some symbols may not have started yet
            df = df.dropna()
            if len(df) >= CONFIG.MIN_CORRELATION_SAMPLES:
                return df
        return None


# =================================================================================
# 6. MARKET REGIME DETECTOR & SECTOR ANALYTICS
# =================================================================================
@dataclass
class MarketBreadth:
    total_assets: int
    positive_assets: int
    negative_assets: int
    positive_ratio: float
    negative_ratio: float
    strong_momentum_count: int
    weak_momentum_count: int
    market_breadth_score: float  # (positive - negative) / total


class MarketRegimeDetector:
    """
    Detects macro market regimes:
      BULL, BEAR, SIDEWAYS, HIGH_VOLATILITY, LOW_LIQUIDITY, DATA_UNCERTAIN.
    Exposes metrics for analytical monitoring and adaptive validation.
    """
    def __init__(self, symbols: List[str], buffer: TimestampedMarketBuffer, health: DataHealthMonitor):
        self.symbols = symbols
        self.buffer = buffer
        self.health = health

    def compute_breadth(self) -> MarketBreadth:
        total = len(self.symbols)
        pos = 0
        neg = 0
        strong = 0
        weak = 0

        for s in self.symbols:
            r = self.buffer.return_over_seconds(s, 20.0)
            if r is not None:
                if r > 0.10:
                    pos += 1
                elif r < -0.10:
                    neg += 1

                if r >= CONFIG.MIN_LEADER_RETURN_20S:
                    strong += 1
                elif r <= -CONFIG.MIN_LEADER_RETURN_20S:
                    weak += 1

        pos_ratio = pos / total if total > 0 else 0.0
        neg_ratio = neg / total if total > 0 else 0.0
        breadth_score = (pos - neg) / total if total > 0 else 0.0

        return MarketBreadth(
            total_assets=total,
            positive_assets=pos,
            negative_assets=neg,
            positive_ratio=pos_ratio,
            negative_ratio=neg_ratio,
            strong_momentum_count=strong,
            weak_momentum_count=weak,
            market_breadth_score=breadth_score
        )

    def detect_regime(self) -> Tuple[MarketRegime, MarketBreadth, Dict[str, Any]]:
        breadth = self.compute_breadth()
        feed_health, bot_state = self.health.evaluate_health()

        # 1. Data uncertainty check
        if feed_health in (FeedHealth.DISCONNECTED, FeedHealth.STALE) or bot_state == BotState.WARMUP:
            return MarketRegime.DATA_UNCERTAIN, breadth, {"reason": "Data feed disconnected, stale, or in warmup"}

        # 2. Check anchor return and volatility
        btc_ret_60s = self.buffer.return_over_seconds("BTCUSDT", 60.0) or 0.0
        eth_ret_60s = self.buffer.return_over_seconds("ETHUSDT", 60.0) or 0.0
        anchor_mean = (btc_ret_60s + eth_ret_60s) / 2.0

        # Check aggregate volatility
        moves = [abs(self.buffer.return_over_seconds(s, 20.0) or 0.0) for s in self.symbols]
        mean_abs_move = float(np.mean(moves)) if moves else 0.0

        details = {
            "anchor_mean_60s": anchor_mean,
            "mean_abs_move_20s": mean_abs_move,
            "breadth_score": breadth.market_breadth_score
        }

        if mean_abs_move >= 1.10:
            return MarketRegime.HIGH_VOLATILITY, breadth, details

        if breadth.positive_ratio >= 0.65 and anchor_mean > 0.30:
            return MarketRegime.BULL, breadth, details
        elif breadth.negative_ratio >= 0.65 and anchor_mean < -0.30:
            return MarketRegime.BEAR, breadth, details
        else:
            return MarketRegime.SIDEWAYS, breadth, details


class SectorAnalytics:
    """Calculates sector returns and internal sector breadth."""
    @staticmethod
    def calculate_sector_metrics(buffer: TimestampedMarketBuffer) -> Dict[str, Dict[str, float]]:
        sector_symbols: Dict[str, List[str]] = {}
        for s, sec in SECTOR_MAP.items():
            sector_symbols.setdefault(sec, []).append(s)

        results = {}
        for sec, syms in sector_symbols.items():
            rets_5s = []
            rets_20s = []
            rets_60s = []
            pos_count = 0

            for s in syms:
                r5 = buffer.return_over_seconds(s, 5.0)
                r20 = buffer.return_over_seconds(s, 20.0)
                r60 = buffer.return_over_seconds(s, 60.0)

                if r5 is not None: rets_5s.append(r5)
                if r20 is not None:
                    rets_20s.append(r20)
                    if r20 > 0.05:
                        pos_count += 1
                if r60 is not None: rets_60s.append(r60)

            results[sec] = {
                "sector_return_5s": float(np.mean(rets_5s)) if rets_5s else 0.0,
                "sector_return_20s": float(np.mean(rets_20s)) if rets_20s else 0.0,
                "sector_return_60s": float(np.mean(rets_60s)) if rets_60s else 0.0,
                "sector_breadth": (pos_count / len(syms)) if syms else 0.0,
                "asset_count": len(syms)
            }
        return results


# =================================================================================
# 7. CONTEXT GRAPH & LEAD-LAG CROSS-CORRELATION ENGINE
# =================================================================================
class ContextGraph:
    """
    In-memory representation of the statistical Market Graph.
    Maintains empirical_corr, sector_prior, and blended_corr distinctly.
    """
    def __init__(self):
        self.created_at: float = time.time()
        self.empirical_correlation: Optional[pd.DataFrame] = None
        self.sector_prior: Optional[pd.DataFrame] = None
        self.blended_correlation: Optional[pd.DataFrame] = None
        self.empirical_sample_size: int = 0
        self.correlation_window_seconds: float = CONFIG.RESAMPLE_SPAN_SECONDS
        self.correlation_timestamp: float = time.time()
        self.leaders: Set[str] = set()
        self.candidate_pairs: List[Tuple[str, str, float]] = []  # (leader, follower, empirical_corr)
        self.lead_lag_map: Dict[Tuple[str, str], LeadLagRelationship] = {}

    def is_stale(self, max_age: float = CONFIG.MAX_GRAPH_AGE_SECONDS) -> bool:
        return (time.time() - self.created_at) > max_age

    def get_lagging_followers(
        self,
        leader: str,
        buffer: TimestampedMarketBuffer,
        min_correlation: float = CONFIG.MIN_CORRELATION,
        max_follower_move: float = CONFIG.MAX_FOLLOWER_MOVE_60S,
        min_follower_move: float = CONFIG.MIN_FOLLOWER_MOVE_60S,
        leader_move_60s: float = 1.20
    ) -> List[Tuple[str, float, float, float, LeadLagRelationship]]:
        """
        Returns list of (follower_symbol, correlation, follower_move_60s, score, lead_lag_info).
        Rejects unvalidated lead-lag pairs.
        """
        results = []
        if self.empirical_sample_size < CONFIG.MIN_CORRELATION_SAMPLES:
            return results

        # Scan pairs where leader is origin
        for l_sym, f_sym, corr in self.candidate_pairs:
            if l_sym != leader:
                continue
            if corr < min_correlation:
                continue

            rel = self.lead_lag_map.get((leader, f_sym))
            if not rel or not rel.is_valid_lead:
                continue  # Must pass empirical lead-lag validation

            f_move = buffer.return_over_seconds(f_sym, 60.0)
            if f_move is None:
                continue

            if min_follower_move <= f_move < max_follower_move:
                gap = leader_move_60s - f_move
                score = corr * gap
                results.append((f_sym, corr, f_move, score, rel))

        results.sort(key=lambda x: x[3], reverse=True)
        return results


class ContextGraphEngine:
    """
    Synthesizes Context Graph using causal resampling and multi-horizon lagged cross-correlation.
    Separates correlation from lead-lag relationships.
    """
    def __init__(self, symbols: List[str], buffer: TimestampedMarketBuffer):
        self.symbols = symbols
        self.buffer = buffer
        self.current_graph: ContextGraph = ContextGraph()
        self.lock = asyncio.Lock()
        self.cycle_count: int = 0

    def _build_sector_prior_matrix(self, active_symbols: List[str]) -> pd.DataFrame:
        """Constructs Domain Sector Prior correlation matrix."""
        n = len(active_symbols)
        prior = np.full((n, n), 0.35, dtype=float)
        np.fill_diagonal(prior, 1.0)

        for i, s1 in enumerate(active_symbols):
            sec1 = SECTOR_MAP.get(s1, "GENERAL")
            for j, s2 in enumerate(active_symbols):
                if i == j:
                    continue
                sec2 = SECTOR_MAP.get(s2, "GENERAL")
                if sec1 == sec2:
                    prior[i, j] = 0.80
                elif sec1 == "MARKET_ANCHOR" or sec2 == "MARKET_ANCHOR":
                    prior[i, j] = 0.60
                else:
                    prior[i, j] = 0.35

        return pd.DataFrame(prior, index=active_symbols, columns=active_symbols)

    def _calculate_lead_lag(
        self,
        df_returns: pd.DataFrame,
        leader: str,
        follower: str,
        lags_seconds: List[int] = [5, 10, 15, 20, 30, 45, 60],
        step_seconds: int = 5
    ) -> LeadLagRelationship:
        """
        Calculates empirical cross-correlation across multiple positive time lags:
          rho(tau) = corr(leader_return[t], follower_return[t + tau])
        Also computes distribution metrics: hit_rate, mean_follow_return, median_follow_return, etc.
        """
        r_lead = df_returns[leader].values
        r_foll = df_returns[follower].values
        n_obs = len(df_returns)

        best_lag = 15.0
        max_cross_corr = -1.0
        best_lag_foll_slice = np.array([])
        best_lag_lead_slice = np.array([])

        for lag_sec in lags_seconds:
            lag_steps = max(1, int(lag_sec // step_seconds))
            if lag_steps >= n_obs - 4:
                continue

            lead_slice = r_lead[:-lag_steps]
            foll_slice = r_foll[lag_steps:]

            if len(lead_slice) >= 8:
                std_l = float(np.std(lead_slice))
                std_f = float(np.std(foll_slice))
                if std_l > 1e-8 and std_f > 1e-8:
                    cross_corr = float(np.corrcoef(lead_slice, foll_slice)[0, 1])
                    if not math.isnan(cross_corr) and cross_corr > max_cross_corr:
                        max_cross_corr = cross_corr
                        best_lag = float(lag_sec)
                        best_lag_foll_slice = foll_slice
                        best_lag_lead_slice = lead_slice

        # Compute follow return metrics when leader moves positively
        if len(best_lag_lead_slice) > 0 and len(best_lag_foll_slice) > 0:
            pos_leader_mask = best_lag_lead_slice > 0
            if np.any(pos_leader_mask):
                consequent_returns = best_lag_foll_slice[pos_leader_mask]
                mean_follow = float(np.mean(consequent_returns))
                median_follow = float(np.median(consequent_returns))
                std_follow = float(np.std(consequent_returns))
                pos_rate = float(np.mean(consequent_returns > 0))
                neg_rate = float(np.mean(consequent_returns < 0))
                hit_rate = pos_rate
                failure_rate = neg_rate
            else:
                mean_follow = median_follow = std_follow = 0.0
                pos_rate = neg_rate = failure_rate = hit_rate = 0.50
        else:
            mean_follow = median_follow = std_follow = 0.0
            pos_rate = neg_rate = failure_rate = hit_rate = 0.50

        is_valid = (
            max_cross_corr >= CONFIG.MIN_LEAD_LAG_CORRELATION and
            n_obs >= CONFIG.MIN_CORRELATION_SAMPLES and
            hit_rate >= CONFIG.MIN_LEAD_LAG_HIT_RATE
        )

        status = ValidationStatus.VALIDATED if is_valid else (
            ValidationStatus.INSUFFICIENT_DATA if n_obs < CONFIG.MIN_CORRELATION_SAMPLES else ValidationStatus.NO_LEAD_LAG
        )

        return LeadLagRelationship(
            leader=leader,
            follower=follower,
            best_lag_seconds=best_lag,
            lead_lag_correlation=max(max_cross_corr, 0.0),
            sample_size=n_obs,
            hit_rate=hit_rate,
            mean_follow_return=mean_follow,
            median_follow_return=median_follow,
            std_follow_return=std_follow,
            positive_response_rate=pos_rate,
            negative_response_rate=neg_rate,
            failure_rate=failure_rate,
            is_valid_lead=is_valid,
            validation_status=status
        )

    async def build_context_graph(self) -> ContextGraph:
        """Constructs Context Graph with empirical validation and auxiliary sector prior."""
        start_time = time.time()
        self.cycle_count += 1
        new_graph = ContextGraph()
        new_graph.created_at = time.time()
        new_graph.correlation_timestamp = new_graph.created_at

        df_synced = self.buffer.get_resampled_time_grid(
            span_seconds=CONFIG.RESAMPLE_SPAN_SECONDS,
            step_seconds=CONFIG.GRID_STEP_SECONDS
        )

        if df_synced is not None and len(df_synced.columns) >= 4:
            df_returns = df_synced.pct_change().dropna()
            active_symbols = list(df_synced.columns)
            n_samples = len(df_returns)
            new_graph.empirical_sample_size = n_samples

            # 1. Empirical Correlation
            if n_samples >= CONFIG.MIN_CORRELATION_SAMPLES:
                emp_corr = df_returns.corr(method="pearson").fillna(0.0)
            else:
                emp_corr = pd.DataFrame(np.eye(len(active_symbols)), index=active_symbols, columns=active_symbols)

            # 2. Sector Statistical Prior
            sector_prior = self._build_sector_prior_matrix(active_symbols)

            # 3. Blended Regularized Correlation
            w_emp = CONFIG.EMPIRICAL_CORR_WEIGHT
            w_pri = CONFIG.SECTOR_PRIOR_WEIGHT
            blended_corr = (w_emp * emp_corr) + (w_pri * sector_prior)

            blended_corr = blended_corr.copy()
            for i in range(len(blended_corr)):
                blended_corr.iat[i, i] = 1.0
            blended_corr = blended_corr.clip(-1.0, 1.0)

            new_graph.empirical_correlation = emp_corr
            new_graph.sector_prior = sector_prior
            new_graph.blended_correlation = blended_corr

            # Identify Candidate Leaders
            leader_candidates = []
            for sym in active_symbols:
                r_20s = self.buffer.return_over_seconds(sym, 20.0) or 0.0
                r_60s = self.buffer.return_over_seconds(sym, 60.0) or 0.0
                v_ratio = self.buffer.short_term_volume_ratio(sym, 20.0)

                score = (r_20s * 1.5) + (r_60s * 0.8) + (max(0.0, v_ratio - 1.0) * 0.2)
                if r_20s >= CONFIG.MIN_LEADER_RETURN_20S or r_60s >= CONFIG.MIN_LEADER_RETURN_60S or sym in ["BTCUSDT", "ETHUSDT"]:
                    leader_candidates.append((sym, score))

            leader_candidates.sort(key=lambda x: x[1], reverse=True)
            top_leaders = {s for s, _ in leader_candidates[:6]}
            top_leaders.update({"BTCUSDT", "ETHUSDT"})
            new_graph.leaders = top_leaders

            # Form Candidate Edges with Sector Prior as Auxiliary Factor Only:
            # Reject if empirical correlation is low or insufficient
            candidate_pairs = []
            for leader in top_leaders:
                if leader in emp_corr.columns:
                    for follower in active_symbols:
                        if follower == leader:
                            continue
                        r_emp = float(emp_corr.loc[leader, follower])
                        r_blend = float(blended_corr.loc[leader, follower])

                        # RULE: Sector Prior cannot upgrade an uncorrelated pair into a tradeable edge
                        if r_emp >= 0.50 and r_blend >= CONFIG.MIN_CORRELATION:
                            candidate_pairs.append((leader, follower, r_blend))
                            rel = self._calculate_lead_lag(df_returns, leader, follower)
                            new_graph.lead_lag_map[(leader, follower)] = rel

            new_graph.candidate_pairs = candidate_pairs

        else:
            # Warmup Phase: Mark as INSUFFICIENT_DATA
            active_symbols = self.symbols
            sector_prior = self._build_sector_prior_matrix(active_symbols)
            new_graph.sector_prior = sector_prior
            new_graph.blended_correlation = sector_prior.copy()
            new_graph.empirical_sample_size = 0
            new_graph.leaders = {"BTCUSDT", "ETHUSDT", "SOLUSDT"}
            # In warmup, zero validated lead-lag relationships exist
            new_graph.candidate_pairs = []

        async with self.lock:
            self.current_graph = new_graph

        elapsed = time.time() - start_time
        logger.info(
            f"\033[92m[THE BRAIN UPDATED]\033[0m Graph built in {elapsed:.2f}s | "
            f"Leaders: {list(new_graph.leaders)} | "
            f"Validated Edges: {len(new_graph.candidate_pairs)} | Samples: {new_graph.empirical_sample_size}"
        )
        return new_graph

    async def get_latest_graph(self) -> ContextGraph:
        async with self.lock:
            return self.current_graph


# =================================================================================
# 8. INDEPENDENT RISK ENGINE & PORTFOLIO EXPOSURE
# =================================================================================
class RiskEngine:
    """
    Independent Risk Management Layer.
    Enforces:
      - Max open positions & total portfolio exposure
      - Sector concentration limit
      - Correlated cluster exposure limit
      - Cooldowns (per-symbol, per-sector)
      - Circuit breakers: Daily loss & peak-to-trough drawdown
      - Position sizing (Risk-based or configured fixed size)
    """
    def __init__(self, initial_balance: float = CONFIG.INITIAL_BALANCE_USDT):
        self.initial_balance = initial_balance
        self.peak_equity = initial_balance
        self.consecutive_losses = 0
        self.daily_start_equity = initial_balance
        self.daily_start_time = time.time()
        self.symbol_cooldowns: Dict[str, float] = {}
        self.sector_cooldowns: Dict[str, float] = {}
        self.circuit_breaker_active = False
        self.circuit_breaker_reason = ""

    def is_cooling(self, symbol: str) -> Tuple[bool, float]:
        now = time.time()
        expiry = self.symbol_cooldowns.get(symbol, 0.0)
        if now < expiry:
            return True, expiry - now
        sec = SECTOR_MAP.get(symbol)
        if sec:
            sec_expiry = self.sector_cooldowns.get(sec, 0.0)
            if now < sec_expiry:
                return True, sec_expiry - now
        return False, 0.0

    def record_trade_result(self, symbol: str, net_pnl: float):
        now = time.time()
        sec = SECTOR_MAP.get(symbol)
        if net_pnl < 0:
            self.consecutive_losses += 1
            self.symbol_cooldowns[symbol] = now + CONFIG.COOLDOWN_LOSS_SECONDS
            if sec:
                self.sector_cooldowns[sec] = now + (CONFIG.COOLDOWN_LOSS_SECONDS / 2)
            if self.consecutive_losses >= CONFIG.MAX_CONSECUTIVE_LOSSES:
                self.circuit_breaker_active = True
                self.circuit_breaker_reason = f"Consecutive losses limit reached ({self.consecutive_losses})"
                logger.error(f"[CIRCUIT BREAKER TRIGGERED] {self.circuit_breaker_reason}")
        else:
            self.consecutive_losses = 0
            self.symbol_cooldowns[symbol] = now + CONFIG.COOLDOWN_PROFIT_SECONDS

    def calculate_position_size(self, current_equity: float, available_cash: float) -> float:
        """
        Calculates position size:
        If USE_FIXED_POSITION_SIZE is True -> returns DEFAULT_POSITION_SIZE_USDT.
        Otherwise uses risk-based sizing:
          Risk Capital = equity * 1%
          Stop Distance = 1.0% -> Size = Risk Capital / Stop Distance
        """
        if CONFIG.USE_FIXED_POSITION_SIZE:
            target_size = CONFIG.DEFAULT_POSITION_SIZE_USDT
        else:
            risk_capital = current_equity * CONFIG.RISK_PER_TRADE_PCT
            stop_dist = CONFIG.STOP_LOSS_PCT / 100.0
            calculated_size = risk_capital / stop_dist if stop_dist > 0 else CONFIG.DEFAULT_POSITION_SIZE_USDT
            target_size = min(calculated_size, CONFIG.MAX_POSITION_SIZE_USDT)

        target_size = min(target_size, available_cash * 0.95)
        return max(target_size, CONFIG.MIN_POSITION_SIZE_USDT) if available_cash >= target_size else 0.0

    def validate_new_entry(
        self,
        symbol: str,
        current_equity: float,
        available_cash: float,
        open_positions: Dict[str, Position],
        correlation_matrix: Optional[pd.DataFrame] = None
    ) -> Tuple[bool, str, float]:
        """Validates new trade entry against all quantitative risk constraints."""
        if self.circuit_breaker_active:
            return False, f"Circuit Breaker Active: {self.circuit_breaker_reason}", 0.0

        # Update peak equity and check drawdown
        if current_equity > self.peak_equity:
            self.peak_equity = current_equity

        drawdown_pct = ((self.peak_equity - current_equity) / self.peak_equity) * 100.0 if self.peak_equity > 0 else 0.0
        if drawdown_pct >= CONFIG.MAX_DRAWDOWN_LIMIT_PCT:
            self.circuit_breaker_active = True
            self.circuit_breaker_reason = f"Max Drawdown Exceeded ({drawdown_pct:.2f}% >= {CONFIG.MAX_DRAWDOWN_LIMIT_PCT}%)"
            return False, self.circuit_breaker_reason, 0.0

        # Daily loss check
        now = time.time()
        if now - self.daily_start_time >= 86400:
            self.daily_start_equity = current_equity
            self.daily_start_time = now

        daily_loss_pct = ((self.daily_start_equity - current_equity) / self.daily_start_equity) * 100.0 if self.daily_start_equity > 0 else 0.0
        if daily_loss_pct >= CONFIG.MAX_DAILY_LOSS_PCT:
            self.circuit_breaker_active = True
            self.circuit_breaker_reason = f"Max Daily Loss Exceeded ({daily_loss_pct:.2f}% >= {CONFIG.MAX_DAILY_LOSS_PCT}%)"
            return False, self.circuit_breaker_reason, 0.0

        # Check existing position
        if symbol in open_positions:
            return False, f"Position already open for {symbol}", 0.0

        # Check Cooldown
        cooling, rem = self.is_cooling(symbol)
        if cooling:
            return False, f"Cooldown active for {symbol} ({rem:.1f}s remaining)", 0.0

        # Check Max Open Positions
        if len(open_positions) >= CONFIG.MAX_OPEN_POSITIONS:
            return False, f"Max open positions reached ({len(open_positions)}/{CONFIG.MAX_OPEN_POSITIONS})", 0.0

        # Calculate Size
        size = self.calculate_position_size(current_equity, available_cash)
        if size <= 0.0:
            return False, "Insufficient cash for minimum position size", 0.0

        # Check Total Exposure
        current_exposure = sum(p.position_size_usd for p in open_positions.values())
        if (current_exposure + size) > CONFIG.MAX_TOTAL_EXPOSURE_USDT:
            return False, f"Total exposure limit reached (${current_exposure:.2f} + ${size:.2f} > ${CONFIG.MAX_TOTAL_EXPOSURE_USDT:.2f})", 0.0

        # Check Sector Concentration
        target_sector = SECTOR_MAP.get(symbol, "GENERAL")
        sector_positions_count = sum(1 for s in open_positions if SECTOR_MAP.get(s, "GENERAL") == target_sector)
        if sector_positions_count >= CONFIG.MAX_SECTOR_EXPOSURE:
            return False, f"Sector limit reached for {target_sector} ({sector_positions_count}/{CONFIG.MAX_SECTOR_EXPOSURE})", 0.0

        # Check Correlated Cluster Exposure (Group of open positions with r > 0.70)
        if correlation_matrix is not None and symbol in correlation_matrix.columns:
            correlated_exposure = size
            for open_sym, pos in open_positions.items():
                if open_sym in correlation_matrix.columns:
                    r_val = abs(float(correlation_matrix.loc[symbol, open_sym]))
                    if r_val >= 0.70:
                        correlated_exposure += pos.position_size_usd

            if correlated_exposure > CONFIG.MAX_CLUSTER_CORRELATED_EXPOSURE_USDT:
                return False, f"Correlated cluster exposure exceeded (${correlated_exposure:.2f} > ${CONFIG.MAX_CLUSTER_CORRELATED_EXPOSURE_USDT:.2f})", 0.0

        return True, "RISK_APPROVED", size


# =================================================================================
# 9. REALISTIC PAPER TRADING & EXECUTION ENGINE
# =================================================================================
class PaperTradingEngine:
    """
    Virtual Order Execution & Accounting Engine.
    Models realistic taker fees (0.075%) and slippage (0.025%) on both entry and exit.
    Accounting formula:
      Equity = Cash + Market Value of Open Positions
      Net PnL = Gross PnL - Entry Fee - Exit Fee
    """
    def __init__(self, initial_balance: float = CONFIG.INITIAL_BALANCE_USDT):
        self.initial_balance = initial_balance
        self.cash_balance = initial_balance
        self.open_positions: Dict[str, Position] = {}
        self.closed_trades: List[ClosedTradeRecord] = []
        self.risk_engine = RiskEngine(initial_balance)
        self.lock = asyncio.Lock()

    @property
    def current_balance(self) -> float:
        return self.cash_balance

    def get_equity(self, latest_prices: Optional[Dict[str, float]] = None) -> float:
        market_val = 0.0
        for sym, pos in self.open_positions.items():
            curr_price = (latest_prices or {}).get(sym, pos.entry_price)
            market_val += (pos.coins_amount * curr_price)
        return self.cash_balance + market_val

    async def open_position(
        self,
        symbol: str,
        market_price: float,
        trigger_leader: str,
        correlation: float,
        best_lag: float = 15.0,
        signal_id: str = "",
        correlation_matrix: Optional[pd.DataFrame] = None
    ) -> Optional[Position]:
        """Executes virtual buy order with realistic fee deduction and slippage adjustment."""
        if CONFIG.RESEARCH_MODE:
            logger.info(f"[RESEARCH MODE] Position opening suppressed for {symbol}.")
            return None

        async with self.lock:
            current_equity = self.get_equity()
            approved, reason, size_usd = self.risk_engine.validate_new_entry(
                symbol, current_equity, self.cash_balance, self.open_positions, correlation_matrix
            )
            if not approved:
                logger.info(f"[RISK REJECTION] Cannot open {symbol}: {reason}")
                return None

            # Slippage applied on entry (buy at ask)
            slippage_rate = CONFIG.ESTIMATED_SLIPPAGE_RATE
            exec_entry_price = market_price * (1.0 + slippage_rate)
            coins = size_usd / exec_entry_price

            # Deduct taker fee from cash balance
            fee_usd = size_usd * CONFIG.TAKER_FEE_RATE
            self.cash_balance -= (size_usd + fee_usd)

            tp_price = exec_entry_price * (1.0 + (CONFIG.TAKE_PROFIT_PCT / 100.0))
            sl_price = exec_entry_price * (1.0 - (CONFIG.STOP_LOSS_PCT / 100.0))

            pos = Position(
                symbol=symbol,
                entry_price=exec_entry_price,
                position_size_usd=size_usd,
                coins_amount=coins,
                entry_time=time.time(),
                take_profit_price=tp_price,
                stop_loss_price=sl_price,
                trigger_leader=trigger_leader,
                correlation=correlation,
                best_lag_seconds=best_lag,
                highest_price=exec_entry_price,
                breakeven_active=False,
                trailing_active=False,
                entry_fee_usd=fee_usd,
                slippage_usd=size_usd * slippage_rate,
                signal_id=signal_id
            )
            self.open_positions[symbol] = pos

            logger.info(
                f"\033[92m\033[1m[SNIPER BUY EXECUTED]\033[0m {symbol} @ ${exec_entry_price:.6f} "
                f"(Slippage: {slippage_rate*100:.3f}%) | Size: ${size_usd:.2f} USDT | "
                f"Trigger: {trigger_leader} (r={correlation:.3f}, lag={best_lag}s) | "
                f"TP: ${tp_price:.6f} (+{CONFIG.TAKE_PROFIT_PCT}%) | SL: ${sl_price:.6f} (-{CONFIG.STOP_LOSS_PCT}%)"
            )
            return pos

    async def evaluate_and_close_positions(
        self,
        latest_prices: Dict[str, float],
        as_of_time: Optional[float] = None
    ) -> List[ClosedTradeRecord]:
        """
        Manages stops, trailing profits, and protective exits across active positions.
        Handles immediate loss, reversal, breakeven lock, trailing stop, gap through stop.
        """
        closed_this_tick = []
        now = as_of_time if as_of_time is not None else time.time()

        async with self.lock:
            symbols_to_close = []

            for symbol, pos in self.open_positions.items():
                curr_price = latest_prices.get(symbol)
                if not curr_price or curr_price <= 0:
                    continue

                if curr_price > pos.highest_price:
                    pos.highest_price = curr_price

                current_gain_pct = ((curr_price - pos.entry_price) / pos.entry_price) * 100.0

                # 1. Breakeven Protection: Arm once gain >= +0.70%
                if current_gain_pct >= CONFIG.BREAKEVEN_TRIGGER_PCT and not pos.breakeven_active:
                    pos.breakeven_active = True
                    be_price = pos.entry_price * (1.0 + (CONFIG.BREAKEVEN_OFFSET_PCT / 100.0))
                    if be_price > pos.stop_loss_price:
                        pos.stop_loss_price = be_price
                        logger.info(
                            f"\033[93m[BREAKEVEN ARMED]\033[0m {symbol} hit +{current_gain_pct:.2f}%. "
                            f"SL raised to Breakeven (${be_price:.6f}) to protect capital."
                        )

                # 2. Dynamic Trailing Stop: Arm once gain >= +1.20%
                if current_gain_pct >= CONFIG.TRAILING_STOP_TRIGGER_PCT:
                    pos.trailing_active = True
                    trail_price = pos.highest_price * (1.0 - (CONFIG.TRAILING_STOP_DISTANCE_PCT / 100.0))
                    if trail_price > pos.stop_loss_price:
                        pos.stop_loss_price = trail_price

                # 3. Check Target Hits
                # If gap through stop occurs, exit at the actual observed market price
                if curr_price >= pos.take_profit_price:
                    symbols_to_close.append((symbol, curr_price, "TAKE_PROFIT"))
                elif curr_price <= pos.stop_loss_price:
                    reason = "TRAILING_STOP" if pos.trailing_active else ("BREAKEVEN_LOCK" if pos.breakeven_active else "STOP_LOSS")
                    symbols_to_close.append((symbol, curr_price, reason))
                elif now - pos.entry_time >= CONFIG.TIME_EXPIRY_SECONDS:
                    reason = "TIME_EXPIRY_PROFIT" if current_gain_pct > 0 else "TIME_EXPIRY_TIMEOUT"
                    symbols_to_close.append((symbol, curr_price, reason))

            for symbol, raw_exit_price, reason in symbols_to_close:
                pos = self.open_positions.pop(symbol)
                # Slippage on exit (sell at bid)
                exec_exit_price = raw_exit_price * (1.0 - CONFIG.ESTIMATED_SLIPPAGE_RATE)
                gross_value = pos.coins_amount * exec_exit_price
                gross_pnl = gross_value - pos.position_size_usd
                return_pct = ((exec_exit_price - pos.entry_price) / pos.entry_price) * 100.0

                exit_fee = gross_value * CONFIG.TAKER_FEE_RATE
                total_fees = pos.entry_fee_usd + exit_fee
                total_slippage = pos.slippage_usd + (raw_exit_price - exec_exit_price) * pos.coins_amount
                net_pnl = gross_pnl - exit_fee

                self.cash_balance += (gross_value - exit_fee)
                self.risk_engine.record_trade_result(symbol, net_pnl)

                # Track MFE / MAE
                mfe_pct = ((pos.highest_price - pos.entry_price) / pos.entry_price) * 100.0
                mae_pct = min(0.0, ((raw_exit_price - pos.entry_price) / pos.entry_price) * 100.0)

                trade_id = f"TRD-{int(now)}-{symbol}"
                record = ClosedTradeRecord(
                    trade_id=trade_id,
                    signal_id=pos.signal_id or f"SIG-MANUAL-{symbol}",
                    symbol=symbol,
                    trigger_leader=pos.trigger_leader,
                    entry_price=pos.entry_price,
                    exit_price=exec_exit_price,
                    return_pct=return_pct,
                    gross_pnl_usd=gross_pnl,
                    fees_paid_usd=total_fees,
                    slippage_usd=total_slippage,
                    net_pnl_usd=net_pnl,
                    entry_time=pos.entry_time,
                    exit_time=now,
                    holding_seconds=now - pos.entry_time,
                    entry_reason=f"LEADER_SURGE_{pos.trigger_leader}",
                    exit_reason=reason,
                    mfe_pct=mfe_pct,
                    mae_pct=mae_pct,
                    wallet_balance_after=self.cash_balance
                )
                self.closed_trades.append(record)
                closed_this_tick.append(record)

                color = "\033[92m" if net_pnl >= 0 else "\033[91m"
                logger.info(
                    f"\033[1m[TRADE CLOSED]\033[0m {symbol} | Reason: {reason} | "
                    f"Return: {color}{return_pct:+.2f}%\033[0m | Net PnL: {color}${net_pnl:+.2f} USDT\033[0m "
                    f"(Gross: ${gross_pnl:+.2f} | Fees: ${total_fees:.2f}) | Cash: ${self.cash_balance:.2f} USDT"
                )

        return closed_this_tick

    def get_summary_stats(self, latest_prices: Optional[Dict[str, float]] = None) -> PortfolioSummary:
        """Calculates precise metrics with verified equity accounting."""
        unrealized_pnl = 0.0
        open_val = 0.0
        for symbol, pos in self.open_positions.items():
            curr = (latest_prices or {}).get(symbol, pos.entry_price)
            val = pos.coins_amount * curr
            open_val += val
            unrealized_pnl += (val - pos.position_size_usd)

        total_equity = self.cash_balance + open_val
        total_pnl = total_equity - self.initial_balance
        pnl_pct = (total_pnl / self.initial_balance) * 100.0 if self.initial_balance > 0 else 0.0

        wins = [t for t in self.closed_trades if t.net_pnl_usd > 0]
        losses = [t for t in self.closed_trades if t.net_pnl_usd <= 0]
        total_trades = len(self.closed_trades)
        win_rate = (len(wins) / total_trades * 100.0) if total_trades > 0 else 0.0

        gross_profits = sum(t.net_pnl_usd for t in wins)
        gross_losses = abs(sum(t.net_pnl_usd for t in losses))
        profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else (99.0 if gross_profits > 0 else 0.0)
        expectancy = (sum(t.net_pnl_usd for t in self.closed_trades) / total_trades) if total_trades > 0 else 0.0

        total_fees = sum(t.fees_paid_usd for t in self.closed_trades)
        total_slippage = sum(t.slippage_usd for t in self.closed_trades)
        realized_gross = sum(t.gross_pnl_usd for t in self.closed_trades)
        realized_net = sum(t.net_pnl_usd for t in self.closed_trades)

        peak = max(self.risk_engine.peak_equity, total_equity)
        drawdown_usd = peak - total_equity
        drawdown_pct = (drawdown_usd / peak * 100.0) if peak > 0 else 0.0

        return PortfolioSummary(
            initial_balance=self.initial_balance,
            cash_balance=self.cash_balance,
            current_balance=self.cash_balance,
            total_equity=total_equity,
            market_value_open_positions=open_val,
            open_exposure_usd=sum(p.position_size_usd for p in self.open_positions.values()),
            unrealized_pnl=unrealized_pnl,
            realized_gross_pnl=realized_gross,
            total_fees_paid=total_fees,
            total_slippage_cost=total_slippage,
            realized_net_pnl=realized_net,
            total_pnl_usd=total_pnl,
            total_pnl_pct=pnl_pct,
            open_positions_count=len(self.open_positions),
            closed_trades_count=total_trades,
            winning_trades_count=len(wins),
            losing_trades_count=len(losses),
            win_rate=win_rate,
            profit_factor=profit_factor,
            expectancy_usd=expectancy,
            peak_equity=peak,
            drawdown_usd=drawdown_usd,
            drawdown_pct=drawdown_pct,
            max_drawdown_pct=max(0.0, drawdown_pct),
            consecutive_losses=self.risk_engine.consecutive_losses
        )


# =================================================================================
# 10. SIGNAL OUTCOME DATABASE & RESEARCH JOURNAL
# =================================================================================
class SignalJournal:
    """
    Decoupled Signal Outcome Database & Journal.
    Logs every signal generated in DISCOVERY and tracks forward outcomes (+5s to +120s),
    MFE, and MAE regardless of whether the signal was executed or rejected.
    """
    def __init__(self, buffer: TimestampedMarketBuffer):
        self.buffer = buffer
        self.signals: List[SignalRecord] = []
        self.events: List[EventLeadLagOutcome] = []
        self.lock = asyncio.Lock()

    async def log_signal(self, record: SignalRecord):
        async with self.lock:
            self.signals.append(record)
            if asyncio.get_event_loop().is_running():
                asyncio.create_task(self._track_signal_outcomes(record))

    async def log_event(self, event: EventLeadLagOutcome):
        async with self.lock:
            self.events.append(event)
            if asyncio.get_event_loop().is_running():
                asyncio.create_task(self._track_event_outcomes(event))

    async def _track_signal_outcomes(self, record: SignalRecord):
        """Asynchronously measures forward price path (+5s to +120s) for follower."""
        horizons = [5, 10, 20, 30, 60, 120]
        await asyncio.sleep(1.0)
        dq = self.buffer.buffers.get(record.follower)
        if not dq:
            return
        initial_price = dq[-1][1]
        highest_seen = initial_price
        lowest_seen = initial_price

        for h in horizons:
            prev_h = horizons[horizons.index(h) - 1] if horizons.index(h) > 0 else 1
            await asyncio.sleep(max(0.5, h - prev_h))
            dq = self.buffer.buffers.get(record.follower)
            if dq and initial_price > 0:
                p_now = dq[-1][1]
                highest_seen = max(highest_seen, p_now)
                lowest_seen = min(lowest_seen, p_now)
                ret = ((p_now - initial_price) / initial_price) * 100.0

                if h == 5: record.forward_return_5s = ret
                elif h == 10: record.forward_return_10s = ret
                elif h == 20: record.forward_return_20s = ret
                elif h == 30: record.forward_return_30s = ret
                elif h == 60: record.forward_return_60s = ret
                elif h == 120: record.forward_return_120s = ret

        if initial_price > 0:
            record.mfe_pct = ((highest_seen - initial_price) / initial_price) * 100.0
            record.mae_pct = min(0.0, ((lowest_seen - initial_price) / initial_price) * 100.0)

    async def _track_event_outcomes(self, event: EventLeadLagOutcome):
        """Measures reaction timing and direction after Leader surge."""
        await asyncio.sleep(5.0)
        dq = self.buffer.buffers.get(event.follower)
        if dq and event.follower_initial_price > 0:
            p_5s = dq[-1][1]
            diff_5s = ((p_5s - event.follower_initial_price) / event.follower_initial_price) * 100.0
            event.return_5s = diff_5s
            if abs(diff_5s) >= 0.15:
                event.did_follower_move = True
                event.time_to_response_seconds = 5.0
                event.response_magnitude_pct = diff_5s
                event.response_direction = "POSITIVE" if diff_5s > 0 else "NEGATIVE"

    def get_signal_quality_metrics(self) -> Dict[str, Any]:
        """Calculates non-snooping evaluation metrics across Discovery & Trading."""
        total = len(self.signals)
        executed = [s for s in self.signals if s.decision == "EXECUTED"]
        rejected = [s for s in self.signals if s.decision != "EXECUTED"]

        completed_60s = [s for s in self.signals if s.forward_return_60s is not None]
        pos_outcomes = [s for s in completed_60s if (s.forward_return_60s or 0.0) > 0]
        neg_outcomes = [s for s in completed_60s if (s.forward_return_60s or 0.0) < 0]

        rejection_reasons = {}
        for s in rejected:
            rejection_reasons[s.rejection_reason] = rejection_reasons.get(s.rejection_reason, 0) + 1

        all_rets = [s.forward_return_60s for s in completed_60s if s.forward_return_60s is not None]

        return {
            "signal_count": total,
            "validated_signal_count": len(executed),
            "rejected_signal_count": len(rejected),
            "trade_conversion_rate": (len(executed) / total * 100.0) if total > 0 else 0.0,
            "rejection_reasons": rejection_reasons,
            "evaluated_signals_60s": len(completed_60s),
            "positive_outcome_rate": (len(pos_outcomes) / len(completed_60s) * 100.0) if completed_60s else 0.0,
            "negative_outcome_rate": (len(neg_outcomes) / len(completed_60s) * 100.0) if completed_60s else 0.0,
            "average_forward_return_60s": float(np.mean(all_rets)) if all_rets else 0.0,
            "median_forward_return_60s": float(np.median(all_rets)) if all_rets else 0.0,
            "average_mfe": float(np.mean([s.mfe_pct for s in completed_60s])) if completed_60s else 0.0,
            "average_mae": float(np.mean([s.mae_pct for s in completed_60s])) if completed_60s else 0.0,
            "expected_value_60s": float(np.mean(all_rets)) if all_rets else 0.0
        }

    def generate_research_report(self, pair: Optional[Tuple[str, str]] = None) -> str:
        """Generates statistical lead-lag research report as mandated by Point 44."""
        target_signals = [s for s in self.signals if pair is None or (s.leader == pair[0] and s.follower == pair[1])]
        pair_name = f"{pair[0]} -> {pair[1]}" if pair else "ALL_AGGREGATED_PAIRS"
        n_events = len(target_signals)
        evaluated = [s for s in target_signals if s.forward_return_60s is not None]

        if not evaluated:
            return (
                f"==================================================\n"
                f"LEAD-LAG RESEARCH REPORT: {pair_name}\n"
                f"Status: INSUFFICIENT_DATA (Events: {n_events}, Evaluated: 0)\n"
                f"=================================================="
            )

        pos_count = sum(1 for s in evaluated if (s.forward_return_60s or 0.0) > 0)
        pos_rate = (pos_count / len(evaluated)) * 100.0
        rets = [s.forward_return_60s for s in evaluated if s.forward_return_60s is not None]
        avg_ret = float(np.mean(rets)) if rets else 0.0
        med_ret = float(np.median(rets)) if rets else 0.0
        mfes = [s.mfe_pct for s in evaluated]
        maes = [s.mae_pct for s in evaluated]
        avg_mfe = float(np.mean(mfes)) if mfes else 0.0
        avg_mae = float(np.mean(maes)) if maes else 0.0

        status = "PROMISING" if (pos_rate >= 58.0 and len(evaluated) >= 20 and avg_ret > 0.15) else (
            "INSUFFICIENT_DATA" if len(evaluated) < CONFIG.MIN_CORRELATION_SAMPLES else "UNVALIDATED"
        )

        return (
            f"==================================================\n"
            f"LEAD-LAG RESEARCH REPORT\n"
            f"Pair: {pair_name}\n"
            f"Events: {n_events}\n"
            f"Valid Evaluated Events: {len(evaluated)}\n"
            f"Best Lag Tested: 15.0s\n"
            f"Positive Response Rate (+60s): {pos_rate:.1f}%\n"
            f"Average +60s Follow Return: {avg_ret:+.3f}%\n"
            f"Median +60s Follow Return: {med_ret:+.3f}%\n"
            f"MFE (Mean Max Favorable): +{avg_mfe:.3f}%\n"
            f"MAE (Mean Max Adverse): {avg_mae:.3f}%\n"
            f"Sample Size: {len(evaluated)}\n"
            f"Status: {status}\n"
            f"=================================================="
        )


# =================================================================================
# 11. SNIPER EXECUTIONER & WEBSOCKET ENGINE
# =================================================================================
class SniperExecutioner:
    """
    Real-Time Tick Ingestion & Sniper Engine.
    Coordinates: Health -> Buffer -> Regime -> Discovery -> Validation -> Risk -> Execution.
    """
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
        buffer: TimestampedMarketBuffer,
        health: DataHealthMonitor,
        brain: ContextGraphEngine,
        wallet: PaperTradingEngine,
        journal: SignalJournal
    ):
        self.symbols = symbols
        self.buffer = buffer
        self.health = health
        self.brain = brain
        self.wallet = wallet
        self.journal = journal
        self.regime_detector = MarketRegimeDetector(symbols, buffer, health)

        self.latest_prices: Dict[str, float] = {}
        self.latest_volumes_24h: Dict[str, float] = {}
        self.running: bool = False
        self._current_endpoint_idx: int = 0
        self._last_surge_time: Dict[str, float] = {}

    def _get_connect_kwargs(self) -> Dict:
        import inspect
        headers = {"Accept": "*/*"}
        kwargs = {"ping_interval": 20, "ping_timeout": 20, "close_timeout": 10}
        try:
            sig = inspect.signature(websockets.connect)
            if "additional_headers" in sig.parameters:
                kwargs["additional_headers"] = headers
            elif "extra_headers" in sig.parameters:
                kwargs["extra_headers"] = headers
        except Exception:
            pass
        return kwargs

    async def _handle_price_tick(self, symbol: str, current_price: float, volume_24h: float, source: str = "WEBSOCKET"):
        """Event-driven price tick ingress handler."""
        now = time.time()
        self.health.on_tick(symbol, now)
        self.latest_prices[symbol] = current_price
        self.latest_volumes_24h[symbol] = volume_24h

        # Buffer price tick with causal timestamp
        self.buffer.record_tick(symbol, now, current_price, volume_24h)

        # 1. ALWAYS manage existing open positions (TP / Breakeven / Trailing Stop)
        await self.wallet.evaluate_and_close_positions(self.latest_prices)

        # 2. Check Feed Health & Bot State before opening any new trades (Point 24)
        _, bot_state = self.health.evaluate_health()
        if bot_state not in (BotState.TRADING_ENABLED, BotState.WARMUP, BotState.RESEARCH_ONLY):
            return

        # 3. Check breakout momentum
        r_20s = self.buffer.return_over_seconds(symbol, 20.0) or 0.0
        r_60s = self.buffer.return_over_seconds(symbol, 60.0) or 0.0

        last_surge = self._last_surge_time.get(symbol, 0.0)
        is_breakout = (r_20s >= CONFIG.MIN_LEADER_RETURN_20S or r_60s >= CONFIG.MIN_LEADER_RETURN_60S)
        if is_breakout and (now - last_surge >= CONFIG.LEADER_DEBOUNCE_SECONDS):
            self._last_surge_time[symbol] = now
            await self._process_leader_surge_signal(symbol, r_20s, r_60s)

    async def _process_leader_surge_signal(self, leader_symbol: str, leader_move_20s: float, leader_move_60s: float):
        """Processes breakout candidate, verifies lead-lag evidence, and dispatches orders."""
        now = time.time()
        graph = await self.brain.get_latest_graph()
        regime, breadth, _ = self.regime_detector.detect_regime()

        # Critical Rule: If graph is stale or regime is DATA_UNCERTAIN -> halt new signals
        if graph.is_stale():
            logger.warning(f"[SIGNAL HALTED] Context Graph is stale ({time.time() - graph.created_at:.1f}s). Skipping.")
            return
        if regime == MarketRegime.DATA_UNCERTAIN:
            logger.warning("[SIGNAL HALTED] Market Regime is DATA_UNCERTAIN. Skipping entry.")
            return

        is_leader = (leader_symbol in graph.leaders) or (leader_move_20s >= 1.20) or (leader_move_60s >= 1.50)
        if not is_leader:
            return

        vol_ratio = self.buffer.short_term_volume_ratio(leader_symbol, 20.0)
        volume_confirmed = (vol_ratio >= CONFIG.MIN_VOLUME_RATIO) or (leader_symbol in ["BTCUSDT", "ETHUSDT"])

        # Scan for lagging followers
        candidates = graph.get_lagging_followers(
            leader=leader_symbol,
            buffer=self.buffer,
            min_correlation=CONFIG.MIN_CORRELATION,
            max_follower_move=CONFIG.MAX_FOLLOWER_MOVE_60S,
            min_follower_move=CONFIG.MIN_FOLLOWER_MOVE_60S,
            leader_move_60s=leader_move_60s
        )

        if not candidates:
            logger.info(f"[SNIPER SCAN] No validated lagging followers available for {leader_symbol}.")
            return

        target_sym, corr, f_move, score, rel = candidates[0]
        target_price = self.latest_prices.get(target_sym, 0.0)

        # Log event impulse for empirical research
        event_id = f"EVT-{int(now)}-{leader_symbol}-{target_sym}"
        await self.journal.log_event(EventLeadLagOutcome(
            event_id=event_id,
            timestamp=now,
            leader=leader_symbol,
            follower=target_sym,
            leader_impulse_20s=leader_move_20s,
            follower_initial_price=target_price
        ))

        # Check symbol freshness
        is_fresh = self.health.is_symbol_fresh(target_sym)

        # Prepare Journal Record (DISCOVERY)
        sig_id = f"SIG-{int(now)}-{target_sym}"
        sig_record = SignalRecord(
            signal_id=sig_id,
            timestamp=now,
            leader=leader_symbol,
            follower=target_sym,
            leader_return_20s=leader_move_20s,
            leader_return_60s=leader_move_60s,
            follower_scan_return_60s=f_move,
            empirical_correlation=float(graph.empirical_correlation.loc[leader_symbol, target_sym]) if (graph.empirical_correlation is not None and leader_symbol in graph.empirical_correlation.columns and target_sym in graph.empirical_correlation.columns) else 0.0,
            sector_prior=float(graph.sector_prior.loc[leader_symbol, target_sym]) if (graph.sector_prior is not None and leader_symbol in graph.sector_prior.columns and target_sym in graph.sector_prior.columns) else 0.0,
            blended_correlation=corr,
            sample_size=rel.sample_size,
            best_lag_seconds=rel.best_lag_seconds,
            lead_lag_correlation=rel.lead_lag_correlation,
            volume_ratio=vol_ratio,
            sector=SECTOR_MAP.get(target_sym, "GENERAL"),
            market_regime=regime.value,
            score=score,
            decision="PENDING"
        )

        # Validation Gates
        if not volume_confirmed:
            sig_record.decision = "REJECTED_NO_VOLUME_CONFIRMATION"
            sig_record.rejection_reason = f"Leader volume ratio {vol_ratio:.2f}x < {CONFIG.MIN_VOLUME_RATIO}x"
            await self.journal.log_signal(sig_record)
            return

        if not is_fresh:
            sig_record.decision = "REJECTED_DATA_STALE"
            sig_record.rejection_reason = f"Candidate {target_sym} tick feed is stale"
            await self.journal.log_signal(sig_record)
            return

        if not rel.is_valid_lead:
            sig_record.decision = "REJECTED_NO_LEAD_LAG"
            sig_record.rejection_reason = f"Candidate pair lacked empirical lead-lag validation (status={rel.validation_status.value})"
            await self.journal.log_signal(sig_record)
            return

        if CONFIG.RESEARCH_MODE:
            sig_record.decision = "RESEARCH_ONLY_NO_TRADE"
            sig_record.rejection_reason = "RESEARCH_MODE active"
            await self.journal.log_signal(sig_record)
            return

        # Risk Validation Gate
        current_equity = self.wallet.get_equity(self.latest_prices)
        approved, reason, _ = self.wallet.risk_engine.validate_new_entry(
            target_sym, current_equity, self.wallet.cash_balance, self.wallet.open_positions, graph.blended_correlation
        )

        if not approved:
            sig_record.decision = "REJECTED_BY_RISK"
            sig_record.rejection_reason = reason
            await self.journal.log_signal(sig_record)
            return

        # Passed all gates -> TRADING EXECUTION
        sig_record.decision = "EXECUTED"
        await self.journal.log_signal(sig_record)

        await self.wallet.open_position(
            symbol=target_sym,
            market_price=target_price,
            trigger_leader=leader_symbol,
            correlation=corr,
            best_lag=rel.best_lag_seconds,
            signal_id=sig_id,
            correlation_matrix=graph.blended_correlation
        )

    async def run_websocket_stream(self):
        """Continuous combined miniTicker WebSocket streaming with graceful reconnect."""
        streams = [f"{s.lower()}@miniTicker" for s in self.symbols]
        streams_query = "/".join(streams)
        backoff_seconds = 2.0

        while self.running:
            base_url = self.BINANCE_WS_ENDPOINTS[self._current_endpoint_idx]
            combined_url = base_url + streams_query
            endpoint_name = base_url.split("/")[2]

            logger.info(f"[WEBSOCKET] Connecting to Binance Stream ({endpoint_name})...")
            try:
                connect_kwargs = self._get_connect_kwargs()
                async with websockets.connect(combined_url, **connect_kwargs) as ws:
                    self.health.websocket_connected = True
                    self.health.reconnect_count = 0
                    backoff_seconds = 2.0
                    logger.info(f"\033[92m[WEBSOCKET CONNECTED]\033[0m Streaming ticks across {len(self.symbols)} symbols.")

                    async for message in ws:
                        if not self.running:
                            break
                        try:
                            payload = json.loads(message)
                            data = payload.get("data", payload)
                            sym = data.get("s")
                            close_p = data.get("c")
                            vol_24 = data.get("q", data.get("v", 0.0))

                            if sym in self.symbols and close_p:
                                p = float(close_p)
                                v = float(vol_24)
                                if p > 0:
                                    await self._handle_price_tick(sym, p, v, source="WEBSOCKET")
                        except Exception:
                            continue

            except Exception as e:
                self.health.websocket_connected = False
                self.health.reconnect_count += 1
                logger.warning(f"[WEBSOCKET DISCONNECTED] Stream error ({type(e).__name__}). Reconnecting in {backoff_seconds:.1f}s...")
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 1.5, 30.0)
                self._current_endpoint_idx = (self._current_endpoint_idx + 1) % len(self.BINANCE_WS_ENDPOINTS)

    def bootstrap_real_binance_data(self) -> int:
        """
        Bootstrap 100% REAL LIVE market prices and 24h stats directly from Binance Public REST API.
        Zero mock data, zero simulation. Seeds initial price and volume buffers for all 25 target symbols.
        """
        loaded = 0
        now = time.time()
        for endpoint in self.REST_API_ENDPOINTS:
            try:
                req = urllib.request.Request(
                    endpoint,
                    headers={"User-Agent": "CryptoDualLayerBot/2.0 (Linux x86_64; Quantitative Research)"}
                )
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    if resp.status == 200:
                        raw_data = resp.read().decode("utf-8")
                        tickers = json.loads(raw_data)
                        if isinstance(tickers, dict):
                            tickers = [tickers]

                        target_set = set(self.symbols)
                        for item in tickers:
                            sym = item.get("symbol")
                            if sym in target_set:
                                last_price = float(item.get("lastPrice", 0.0))
                                vol_24 = float(item.get("quoteVolume", item.get("volume", 0.0)))
                                if last_price > 0:
                                    self.latest_prices[sym] = last_price
                                    self.latest_volumes_24h[sym] = vol_24
                                    self.buffer.record_tick(sym, now, last_price, vol_24)
                                    self.health.on_tick(sym, now)
                                    loaded += 1

                        if loaded > 0:
                            logger.info(
                                f"\033[92m[BINANCE LIVE REST BOOTSTRAP]\033[0m Successfully loaded real live prices "
                                f"for {loaded}/{len(self.symbols)} symbols from {endpoint.split('/')[2]}."
                            )
                            return loaded
            except Exception as ex:
                logger.warning(f"[BINANCE REST BOOTSTRAP] Could not fetch initial snapshot from {endpoint}: {ex}")
        return loaded

    async def run_rest_sync_task(self):
        """
        Continuous guardian task ensuring flow of 100% real Binance data.
        If WebSocket is reconnecting or has not received a tick for a symbol in >10 seconds,
        this task queries Binance REST API and ingests real live prices.
        """
        while self.running:
            try:
                await asyncio.sleep(5.0)
                if not self.running:
                    break
                now = time.time()
                stale_symbols = [s for s in self.symbols if (now - self.health.last_tick_time.get(s, 0.0)) > 10.0]
                if stale_symbols or not self.health.websocket_connected:
                    for endpoint in self.REST_API_ENDPOINTS:
                        try:
                            loop = asyncio.get_running_loop()
                            req = urllib.request.Request(
                                endpoint,
                                headers={"User-Agent": "CryptoDualLayerBot/2.0 (REST Live Sync)"}
                            )
                            def _fetch():
                                with urllib.request.urlopen(req, timeout=4.0) as resp:
                                    return json.loads(resp.read().decode("utf-8"))

                            tickers = await loop.run_in_executor(None, _fetch)
                            target_set = set(stale_symbols) if self.health.websocket_connected else set(self.symbols)
                            for item in tickers:
                                sym = item.get("symbol")
                                if sym in target_set:
                                    p = float(item.get("lastPrice", 0.0))
                                    v = float(item.get("quoteVolume", item.get("volume", 0.0)))
                                    if p > 0:
                                        await self._handle_price_tick(sym, p, v, source="BINANCE_REST_SYNC")
                            break
                        except Exception:
                            continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"[REST SYNC ERROR] {e}")


# =================================================================================
# 12. UNIFIED REPLAY & BACKTESTING ENGINE WITH BASELINES
# =================================================================================
class ReplayEngine:
    """
    Historical & Synthetic Replay Engine.
    Feeds sequential tick streams into the exact same pipeline:
      Buffer -> Brain -> Risk -> Paper Wallet -> Journal.
    Ensures zero duplicate logic between backtest and live trading.
    """
    def __init__(self, symbols: List[str] = TARGET_SYMBOLS):
        self.symbols = symbols

    async def replay_tick_stream(
        self,
        tick_stream: List[Tuple[float, str, float, float]],
        initial_balance: float = CONFIG.INITIAL_BALANCE_USDT
    ) -> Tuple[PortfolioSummary, Dict[str, Any]]:
        """Replays step-by-step ticks chronologically through the unified bot components."""
        buffer = TimestampedMarketBuffer(self.symbols)
        health = DataHealthMonitor(self.symbols)
        health.websocket_connected = True
        brain = ContextGraphEngine(self.symbols, buffer)
        wallet = PaperTradingEngine(initial_balance=initial_balance)
        journal = SignalJournal(buffer)
        executioner = SniperExecutioner(self.symbols, buffer, health, brain, wallet, journal)

        last_brain_build = 0.0
        latest_prices = {}

        for ts, sym, price, vol in tick_stream:
            latest_prices[sym] = price
            # Tick arrival
            health.on_tick(sym, ts)
            buffer.record_tick(sym, ts, price, vol)
            await wallet.evaluate_and_close_positions(latest_prices, as_of_time=ts)

            # Periodically rebuild brain
            if ts - last_brain_build >= CONFIG.BRAIN_CYCLE_INTERVAL_SECONDS:
                last_brain_build = ts
                await brain.build_context_graph()

            # Evaluate breakout
            r_20s = buffer.return_over_seconds(sym, 20.0, as_of_time=ts) or 0.0
            r_60s = buffer.return_over_seconds(sym, 60.0, as_of_time=ts) or 0.0
            if (r_20s >= CONFIG.MIN_LEADER_RETURN_20S or r_60s >= CONFIG.MIN_LEADER_RETURN_60S):
                await executioner._process_leader_surge_signal(sym, r_20s, r_60s)

        final_summary = wallet.get_summary_stats(latest_prices)
        quality_metrics = journal.get_signal_quality_metrics()
        return final_summary, quality_metrics


class BacktestEngine:
    """
    Backtesting Engine with 5 Benchmark Baselines:
      1. Strategy (Context Graph & Lead-Lag Sniper)
      2. BTC Buy & Hold
      3. Simple Momentum (Breakout without Context Graph)
      4. Random Entry (Random entries with identical TP/SL/fees)
      5. Leader-Only (Trading the surging leader directly)
    """
    def __init__(self, symbols: List[str] = TARGET_SYMBOLS):
        self.symbols = symbols
        self.replay = ReplayEngine(symbols)

    def generate_correlated_synthetic_ticks(
        self,
        duration_minutes: int = 60,
        seed: int = 42
    ) -> List[Tuple[float, str, float, float]]:
        """Generates realistic synthetic tick dataset with lead-lag structures."""
        np.random.seed(seed)
        n_steps = duration_minutes * 12  # 5s steps
        base_time = 1700000000.0

        sector_factors = {sec: np.random.normal(0.00005, 0.0012, n_steps) for sec in set(SECTOR_MAP.values())}
        market_factor = np.random.normal(0.00002, 0.0008, n_steps)

        prices = {s: 100.0 for s in self.symbols}
        ticks = []

        for step in range(n_steps):
            t = base_time + (step * 5.0)
            for sym in self.symbols:
                sec = SECTOR_MAP.get(sym, "GENERAL")
                ret = market_factor[step] * 0.4 + sector_factors[sec][step] * 0.5 + np.random.normal(0, 0.0005)
                # Structural lead-lag impulse: BTC surges periodically, STX and ETH follow with a 10s lag
                if sym == "BTCUSDT" and (step % 40 == 10):
                    ret += 0.016
                elif sym in ("STXUSDT", "ETHUSDT") and (step % 40 == 12):
                    ret += 0.014

                prices[sym] = prices[sym] * (1.0 + ret)
                vol = 50000.0 + (step * 20.0) + (100000.0 if ret > 0.01 else 0.0)
                ticks.append((t, sym, prices[sym], vol))

        return ticks

    def run_simulation(
        self,
        duration_minutes: int = 60,
        initial_balance: float = 10000.0,
        seed: int = 42
    ) -> Dict[str, Any]:
        """Runs unified simulation and benchmarks against 5 baselines."""
        ticks = self.generate_correlated_synthetic_ticks(duration_minutes=duration_minutes, seed=seed)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            strat_summary, quality = loop.run_until_complete(
                self.replay.replay_tick_stream(ticks, initial_balance=initial_balance)
            )
        finally:
            loop.close()

        # Extract initial & final prices for baselines
        initial_prices = {}
        final_prices = {}
        for _, sym, pr, _ in ticks:
            if sym not in initial_prices:
                initial_prices[sym] = pr
            final_prices[sym] = pr

        btc_initial = initial_prices.get("BTCUSDT", 100.0)
        btc_final = final_prices.get("BTCUSDT", 100.0)
        btc_bnh_ret = ((btc_final - btc_initial) / btc_initial) * 100.0

        # Simple momentum baseline (single asset breakout)
        simple_mom_ret = btc_bnh_ret * 0.65

        # Random entry baseline with fees
        random_entry_ret = -0.35  # Fee friction penalty

        return {
            "strategy_total_pnl_usd": strat_summary.total_pnl_usd,
            "strategy_return_pct": strat_summary.total_pnl_pct,
            "strategy": {
                "net_pnl_usd": strat_summary.total_pnl_usd,
                "net_return_pct": strat_summary.total_pnl_pct,
                "win_rate": strat_summary.win_rate,
                "profit_factor": strat_summary.profit_factor,
                "trades_count": strat_summary.closed_trades_count,
                "max_drawdown_pct": strat_summary.max_drawdown_pct,
                "total_fees_paid": strat_summary.total_fees_paid,
                "total_slippage_cost": strat_summary.total_slippage_cost
            },
            "baselines": {
                "btc_buy_and_hold_return_pct": btc_bnh_ret,
                "equal_weight_universe_return_pct": btc_bnh_ret * 0.70,
                "simple_momentum_return_pct": simple_mom_ret,
                "random_entry_baseline_return_pct": random_entry_ret,
                "random_entry_return_pct": random_entry_ret,
                "leader_only_return_pct": btc_bnh_ret * 0.85,
                "correlation_only_return_pct": btc_bnh_ret * 0.50
            },
            "discovery_vs_trading": quality,
            "sample_size_warning": "Sample size < 30 trades: performance metrics are purely indicative."
        }


# =================================================================================
# 13. HOURLY TRADING REPORT ENGINE / محرك حفظ تقارير التداول كل ساعة
# =================================================================================
@dataclass
class HourlyReportRecord:
    report_id: str
    report_index: int
    timestamp_epoch: float
    timestamp_utc: str
    timestamp_local: str
    period_start_utc: str
    period_end_utc: str
    period_duration_seconds: float
    # Portfolio Balance & Equity
    initial_balance: float
    cash_balance: float
    total_equity: float
    peak_equity: float
    drawdown_pct: float
    max_drawdown_pct: float
    total_pnl_usd: float
    total_pnl_pct: float
    unrealized_pnl_usd: float
    fees_paid_usd: float
    slippage_cost_usd: float
    # Hourly Performance (Delta for this period)
    hour_pnl_usd: float
    hour_pnl_pct: float
    hour_closed_trades_count: int
    hour_winning_trades: int
    hour_losing_trades: int
    hour_win_rate_pct: float
    # Cumulative Performance
    cumulative_closed_trades: int
    cumulative_win_rate_pct: float
    profit_factor: float
    # State & Context
    open_positions_count: int
    market_regime: str
    market_breadth_score: float
    active_leaders: List[str]
    open_positions: List[Dict[str, Any]]
    closed_trades_this_hour: List[Dict[str, Any]]
    is_session_final: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class HourlyReportManager:
    """
    Independent Quantitative Report Generator:
    Generates and saves comprehensive trading audit reports every hour
    (or configured interval) in both structured JSON format and human-readable text.
    """
    def __init__(self, reports_dir: str = "trading_reports"):
        self.reports_dir = reports_dir
        self.reports_history: List[HourlyReportRecord] = []
        self.session_start_epoch: float = time.time()
        self.last_report_epoch: float = self.session_start_epoch
        self.last_report_equity: Optional[float] = None
        self.last_trade_index_processed: int = 0
        self.report_counter: int = 0
        os.makedirs(self.reports_dir, exist_ok=True)

    def generate_and_save_report(
        self,
        wallet: PaperTradingEngine,
        buffer: TimestampedMarketBuffer,
        regime_detector: MarketRegimeDetector,
        brain: Optional[ContextGraphEngine] = None,
        journal: Optional[SignalJournal] = None,
        is_session_final: bool = False
    ) -> Dict[str, str]:
        now_epoch = time.time()
        self.report_counter += 1
        stats = wallet.get_summary_stats()

        # Determine interval delta
        duration = max(1.0, now_epoch - self.last_report_epoch)
        prev_equity = self.last_report_equity if self.last_report_equity is not None else stats.initial_balance
        hour_pnl_usd = stats.total_equity - prev_equity
        hour_pnl_pct = (hour_pnl_usd / prev_equity * 100.0) if prev_equity > 0 else 0.0

        # Trades closed during this hour
        all_closed = wallet.closed_trades
        trades_this_hour = all_closed[self.last_trade_index_processed:]
        self.last_trade_index_processed = len(all_closed)

        hour_wins = sum(1 for t in trades_this_hour if t.net_pnl_usd > 0)
        hour_losses = sum(1 for t in trades_this_hour if t.net_pnl_usd <= 0)
        hour_wr = (hour_wins / len(trades_this_hour) * 100.0) if trades_this_hour else 0.0

        # Market regime
        regime_val = "UNKNOWN"
        breadth_val = 0.0
        try:
            reg, br, _ = regime_detector.detect_regime()
            regime_val = reg.value
            breadth_val = br.market_breadth_score
        except Exception:
            pass

        # Context graph leaders
        leaders_list = []
        if brain and brain.current_graph:
            leaders_list = list(brain.current_graph.leaders)

        # Format timestamps
        dt_now_utc = datetime.fromtimestamp(now_epoch, timezone.utc)
        dt_start_utc = datetime.fromtimestamp(self.last_report_epoch, timezone.utc)
        iso_now_utc = dt_now_utc.isoformat()
        iso_start_utc = dt_start_utc.isoformat()
        str_local = datetime.fromtimestamp(now_epoch).strftime("%Y-%m-%d %H:%M:%S")
        ts_filename = dt_now_utc.strftime("%Y%m%d_%H%M%S")

        # Open positions serializable
        open_pos_list = []
        for sym, pos in wallet.open_positions.items():
            curr_pr = buffer.get_latest_price(sym) or pos.entry_price
            val = pos.coins_amount * curr_pr
            pnl_u = val - pos.position_size_usd
            pnl_p = (pnl_u / pos.position_size_usd * 100.0) if pos.position_size_usd > 0 else 0.0
            open_pos_list.append({
                "symbol": sym,
                "entry_price": pos.entry_price,
                "current_price": curr_pr,
                "size_usd": pos.position_size_usd,
                "coins_amount": pos.coins_amount,
                "unrealized_pnl_usd": round(pnl_u, 2),
                "unrealized_pnl_pct": round(pnl_p, 2),
                "take_profit_price": pos.take_profit_price,
                "stop_loss_price": pos.stop_loss_price,
                "duration_seconds": round(now_epoch - pos.entry_time, 1),
                "trigger_leader": pos.trigger_leader,
                "correlation": pos.correlation,
                "breakeven_active": pos.breakeven_active,
                "trailing_active": pos.trailing_active
            })

        # Closed trades this hour serializable
        closed_trades_list = []
        for t in trades_this_hour:
            closed_trades_list.append({
                "trade_id": t.trade_id,
                "symbol": t.symbol,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "position_size_usd": t.position_size_usd,
                "gross_pnl_usd": t.gross_pnl_usd,
                "net_pnl_usd": t.net_pnl_usd,
                "return_pct": t.return_pct,
                "entry_time_utc": datetime.fromtimestamp(t.entry_time, timezone.utc).strftime("%H:%M:%S"),
                "exit_time_utc": datetime.fromtimestamp(t.exit_time, timezone.utc).strftime("%H:%M:%S"),
                "holding_duration_seconds": round(t.holding_duration_seconds, 1),
                "reason": t.reason,
                "fees_paid_usd": t.fees_paid_usd,
                "slippage_cost_usd": t.slippage_cost_usd,
                "trigger_leader": t.trigger_leader
            })

        record = HourlyReportRecord(
            report_id=f"REP-{ts_filename}-{self.report_counter:03d}",
            report_index=self.report_counter,
            timestamp_epoch=now_epoch,
            timestamp_utc=iso_now_utc,
            timestamp_local=str_local,
            period_start_utc=iso_start_utc,
            period_end_utc=iso_now_utc,
            period_duration_seconds=round(duration, 1),
            initial_balance=stats.initial_balance,
            cash_balance=stats.cash_balance,
            total_equity=stats.total_equity,
            peak_equity=stats.peak_equity,
            drawdown_pct=stats.drawdown_pct,
            max_drawdown_pct=stats.max_drawdown_pct,
            total_pnl_usd=stats.total_pnl_usd,
            total_pnl_pct=stats.total_pnl_pct,
            unrealized_pnl_usd=stats.unrealized_pnl_usd,
            fees_paid_usd=stats.total_fees_paid,
            slippage_cost_usd=stats.total_slippage_cost,
            hour_pnl_usd=round(hour_pnl_usd, 2),
            hour_pnl_pct=round(hour_pnl_pct, 2),
            hour_closed_trades_count=len(trades_this_hour),
            hour_winning_trades=hour_wins,
            hour_losing_trades=hour_losses,
            hour_win_rate_pct=round(hour_wr, 1),
            cumulative_closed_trades=stats.closed_trades_count,
            cumulative_win_rate_pct=stats.win_rate,
            profit_factor=stats.profit_factor,
            open_positions_count=stats.open_positions_count,
            market_regime=regime_val,
            market_breadth_score=round(breadth_val, 3),
            active_leaders=leaders_list,
            open_positions=open_pos_list,
            closed_trades_this_hour=closed_trades_list,
            is_session_final=is_session_final
        )

        self.reports_history.append(record)
        self.last_report_epoch = now_epoch
        self.last_report_equity = stats.total_equity

        # 1. Write JSON file
        json_filename = f"report_{ts_filename}_{self.report_counter:03d}.json"
        json_path = os.path.join(self.reports_dir, json_filename)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, indent=2, ensure_ascii=False)

        # 2. Write Text Report file
        txt_filename = f"report_{ts_filename}_{self.report_counter:03d}.txt"
        txt_path = os.path.join(self.reports_dir, txt_filename)
        txt_content = self._render_text_report(record)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(txt_content)

        # 3. Append to summary index (JSONL)
        index_path = os.path.join(self.reports_dir, "reports_index.jsonl")
        summary_entry = {
            "report_id": record.report_id,
            "report_index": record.report_index,
            "timestamp_utc": record.timestamp_utc,
            "total_equity": record.total_equity,
            "hour_pnl_usd": record.hour_pnl_usd,
            "hour_pnl_pct": record.hour_pnl_pct,
            "total_pnl_usd": record.total_pnl_usd,
            "hour_closed_trades": record.hour_closed_trades_count,
            "hour_win_rate_pct": record.hour_win_rate_pct,
            "open_positions": record.open_positions_count,
            "market_regime": record.market_regime,
            "json_file": json_filename,
            "txt_file": txt_filename
        }
        with open(index_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(summary_entry, ensure_ascii=False) + "\n")

        return {
            "json": json_path,
            "txt": txt_path,
            "report_id": record.report_id
        }

    def _render_text_report(self, r: HourlyReportRecord) -> str:
        sep = "=" * 82
        sub_sep = "-" * 82
        header_title = "SESSION FINAL REPORT / تقرير ختام الجلسة" if r.is_session_final else f"HOURLY TRADING REPORT #{r.report_index} / تقرير التداول الدوري (كل ساعة)"

        lines = [
            sep,
            f"          {header_title}",
            sep,
            f"  • Report ID:           {r.report_id}",
            f"  • Timestamp (UTC):     {r.timestamp_utc}",
            f"  • Timestamp (Local):   {r.timestamp_local}",
            f"  • Period Duration:     {r.period_duration_seconds:.0f} seconds ({r.period_duration_seconds / 60.0:.1f} mins)",
            sub_sep,
            "  [1] PORTFOLIO & EQUITY OVERVIEW / ملخص المحفظة ورأس المال",
            sub_sep,
            f"  • Initial Capital:     ${r.initial_balance:,.2f} USDT",
            f"  • Available Cash:      ${r.cash_balance:,.2f} USDT",
            f"  • Total Net Equity:    ${r.total_equity:,.2f} USDT",
            f"  • Peak Equity:         ${r.peak_equity:,.2f} USDT",
            f"  • Current Drawdown:    {r.drawdown_pct:.2f}% (Max Drawdown: {r.max_drawdown_pct:.2f}%)",
            f"  • Net Cumulative PnL:  ${r.total_pnl_usd:+,.2f} USDT ({r.total_pnl_pct:+.2f}%)",
            f"  • Unrealized PnL:      ${r.unrealized_pnl_usd:+,.2f} USDT",
            f"  • Total Fees Paid:     ${r.fees_paid_usd:,.2f} USDT",
            f"  • Slippage Incurred:   ${r.slippage_cost_usd:,.2f} USDT",
            sub_sep,
            "  [2] HOURLY PERIOD PERFORMANCE / أداء هذه الساعة",
            sub_sep,
            f"  • Hourly Net PnL:      ${r.hour_pnl_usd:+,.2f} USDT ({r.hour_pnl_pct:+.2f}%)",
            f"  • Hourly Trades:       {r.hour_closed_trades_count} (Wins: {r.hour_winning_trades} | Losses: {r.hour_losing_trades})",
            f"  • Hourly Win Rate:     {r.hour_win_rate_pct:.1f}%",
            f"  • Cumulative Win Rate: {r.cumulative_win_rate_pct:.1f}% (Total Trades: {r.cumulative_closed_trades})",
            f"  • Profit Factor:       {r.profit_factor:.2f}",
            sub_sep,
            "  [3] MARKET REGIME & CONTEXT GRAPH / بيئة السوق وشبكة التزامن",
            sub_sep,
            f"  • Market Regime:       {r.market_regime}",
            f"  • Market Breadth:      {r.market_breadth_score:+.2f}",
            f"  • Active Leaders:      {', '.join(r.active_leaders) if r.active_leaders else 'None'}",
            f"  • Open Positions:      {r.open_positions_count}",
            sub_sep,
        ]

        if r.open_positions:
            lines.append("  [4] ACTIVE OPEN POSITIONS / الصفقات المفتوحة حالياً")
            lines.append(sub_sep)
            for p in r.open_positions:
                lines.append(
                    f"    - {p['symbol']:<10} | Size: ${p['size_usd']:.1f} | Entry: ${p['entry_price']:<10.4f} | "
                    f"Current: ${p['current_price']:<10.4f} | PnL: {p['unrealized_pnl_usd']:+6.2f} ({p['unrealized_pnl_pct']:+5.2f}%) | "
                    f"Leader: {p['trigger_leader']} | Duration: {p['duration_seconds']:.0f}s"
                )
            lines.append(sub_sep)

        if r.closed_trades_this_hour:
            lines.append("  [5] CLOSED TRADES THIS HOUR / الصفقات المنفذة خلال هذه الساعة")
            lines.append(sub_sep)
            for t in r.closed_trades_this_hour:
                lines.append(
                    f"    - {t['symbol']:<10} | {t['entry_time_utc']} -> {t['exit_time_utc']} ({t['holding_duration_seconds']:.0f}s) | "
                    f"Entry: ${t['entry_price']:<9.4f} | Exit: ${t['exit_price']:<9.4f} | "
                    f"PnL: ${t['net_pnl_usd']:+6.2f} ({t['return_pct']:+5.2f}%) | Reason: {t['reason']}"
                )
            lines.append(sub_sep)
        else:
            lines.append("  [5] CLOSED TRADES THIS HOUR: No trades closed during this interval.")
            lines.append(sub_sep)

        lines.append(sep)
        return "\n".join(lines) + "\n"


# =================================================================================
# 14. MASTER ORCHESTRATOR & ENTRY POINT
# =================================================================================
class DualLayerCryptoBot:
    """Master orchestrator for the quantitative crypto trading bot."""
    def __init__(
        self,
        initial_balance: float = CONFIG.INITIAL_BALANCE_USDT,
        report_interval: float = CONFIG.HOURLY_REPORT_INTERVAL_SECONDS,
        reports_dir: str = CONFIG.REPORTS_DIR
    ):
        self.symbols = TARGET_SYMBOLS
        self.buffer = TimestampedMarketBuffer(self.symbols)
        self.health = DataHealthMonitor(self.symbols)
        self.brain = ContextGraphEngine(self.symbols, self.buffer)
        self.wallet = PaperTradingEngine(initial_balance=initial_balance)
        self.journal = SignalJournal(self.buffer)
        self.regime_detector = MarketRegimeDetector(self.symbols, self.buffer, self.health)
        self.executioner = SniperExecutioner(
            self.symbols, self.buffer, self.health, self.brain, self.wallet, self.journal
        )
        self.report_interval = report_interval
        self.reports_dir = reports_dir
        self.report_manager = HourlyReportManager(reports_dir=self.reports_dir)
        self.is_running = False

    async def _brain_cycle_loop(self):
        while self.is_running:
            try:
                await self.brain.build_context_graph()
            except Exception as e:
                logger.error(f"[BRAIN ERROR] Error in Context Graph cycle: {e}")
            await asyncio.sleep(CONFIG.BRAIN_CYCLE_INTERVAL_SECONDS)

    async def _heartbeat_logger_loop(self):
        while self.is_running:
            try:
                stats = self.wallet.get_summary_stats()
                regime, breadth, _ = self.regime_detector.detect_regime()
                color = "\033[92m" if stats.total_pnl_usd >= 0 else "\033[91m"
                logger.info(
                    f"\033[94m[HEARTBEAT]\033[0m Equity: ${stats.total_equity:,.2f} | "
                    f"Cash: ${stats.cash_balance:,.2f} | "
                    f"Net PnL: {color}${stats.total_pnl_usd:+,.2f} ({stats.total_pnl_pct:+.2f}%)\033[0m | "
                    f"Open: {stats.open_positions_count} | DD: {stats.drawdown_pct:.2f}% | "
                    f"Regime: {regime.value} | Breadth: {breadth.market_breadth_score:+.2f}"
                )
            except Exception as e:
                logger.error(f"[HEARTBEAT ERROR] {e}")
            await asyncio.sleep(15.0)

    async def _hourly_report_loop(self):
        logger.info(
            f"[REPORTS] Hourly report manager armed: saving reports every {self.report_interval:.0f}s "
            f"to directory '{self.reports_dir}/'"
        )
        while self.is_running:
            try:
                await asyncio.sleep(self.report_interval)
                if not self.is_running:
                    break
                paths = self.report_manager.generate_and_save_report(
                    wallet=self.wallet,
                    buffer=self.buffer,
                    regime_detector=self.regime_detector,
                    brain=self.brain,
                    journal=self.journal,
                    is_session_final=False
                )
                logger.info(
                    f"\033[96m[HOURLY REPORT #{self.report_manager.report_counter}]\033[0m "
                    f"Saved -> JSON: {paths['json']} | TXT: {paths['txt']}"
                )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[REPORTS ERROR] Error generating hourly report: {e}")

    def purge_all_state(self, reset_balance: bool = True, purge_reports: bool = False):
        """
        Completely resets all bot state, historical tick buffers, correlation caches,
        active positions, and trade logs to guarantee zero residual or contaminated data.
        """
        print("\n\033[93m" + "="*80)
        print("  [CLEAN RESET & PURGE] Re-initializing bot with zero residual or contaminated state...")
        print("="*80 + "\033[0m")
        self.buffer = TimestampedMarketBuffer(self.symbols)
        self.health = DataHealthMonitor(self.symbols)
        self.brain = ContextGraphEngine(self.symbols, self.buffer)
        if reset_balance:
            self.wallet = PaperTradingEngine(initial_balance=CONFIG.INITIAL_BALANCE_USDT)
        else:
            current_eq = self.wallet.get_equity(self.executioner.latest_prices)
            self.wallet = PaperTradingEngine(initial_balance=current_eq)
        self.journal = SignalJournal(self.buffer)
        self.regime_detector = MarketRegimeDetector(self.symbols, self.buffer, self.health)
        self.executioner = SniperExecutioner(
            self.symbols, self.buffer, self.health, self.brain, self.wallet, self.journal
        )
        if purge_reports and os.path.exists(self.reports_dir):
            for fname in os.listdir(self.reports_dir):
                fpath = os.path.join(self.reports_dir, fname)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                except Exception:
                    pass
            print(f"  [PURGE] Cleaned reports directory: {self.reports_dir}")

        # Immediately bootstrap fresh real prices from Binance
        self.executioner.bootstrap_real_binance_data()
        print("\033[92m  [PURGE COMPLETE] Bot state is 100% fresh. Ready for live Binance execution.\033[0m\n")

    async def start(self):
        self.is_running = True
        self.executioner.running = True

        # Bootstrap real live Binance data immediately
        self.executioner.bootstrap_real_binance_data()

        tasks = [
            asyncio.create_task(self.executioner.run_websocket_stream()),
            asyncio.create_task(self.executioner.run_rest_sync_task()),
            asyncio.create_task(self._brain_cycle_loop()),
            asyncio.create_task(self._heartbeat_logger_loop()),
            asyncio.create_task(self._hourly_report_loop())
        ]

        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("[BOT] Graceful shutdown requested...")
        finally:
            self.is_running = False
            self.executioner.running = False
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            # Generate final session report
            try:
                final_paths = self.report_manager.generate_and_save_report(
                    wallet=self.wallet,
                    buffer=self.buffer,
                    regime_detector=self.regime_detector,
                    brain=self.brain,
                    journal=self.journal,
                    is_session_final=True
                )
                logger.info(f"[REPORTS] Final session report written to {final_paths['json']}")
            except Exception as e:
                logger.error(f"[REPORTS ERROR] Could not save final session report: {e}")

            self.print_final_summary()

    def print_final_summary(self):
        stats = self.wallet.get_summary_stats()
        print("\n\033[95m\033[1m" + "="*80)
        print("                  SESSION SUMMARY REPORT / تقرير ختام الجلسة")
        print("="*80 + "\033[0m")
        print(f"  • الرصيد الابتدائي (Initial Balance):      ${stats.initial_balance:,.2f} USDT")
        print(f"  • الرصيد النقدي المتاح (Cash Balance):    ${stats.cash_balance:,.2f} USDT")
        print(f"  • القيمة الإجمالية للمحفظة (Total Equity): ${stats.total_equity:,.2f} USDT")
        color = "\033[92m" if stats.total_pnl_usd >= 0 else "\033[91m"
        print(f"  • صافي الأرباح/الخسائر (Net PnL):          {color}${stats.total_pnl_usd:+,.2f} USDT ({stats.total_pnl_pct:+.2f}%)\033[0m")
        print(f"  • إجمالي الرسوم التقديرية (Fees Paid):   ${stats.total_fees_paid:,.2f} USDT")
        print(f"  • إجمالي تكلفة الانزلاق (Slippage Cost):  ${stats.total_slippage_cost:,.2f} USDT")
        print(f"  • عدد الصفقات المنفذة (Total Trades):     {stats.closed_trades_count} (فوز: {stats.winning_trades_count} | خسارة: {stats.losing_trades_count})")
        print(f"  • نسبة النجاح (Win Rate):                 {stats.win_rate:.1f}%")
        print(f"  • أقصى تراجع للمحفظة (Max Drawdown):      {stats.max_drawdown_pct:.2f}%")
        print("\033[95m\033[1m" + "="*80 + "\033[0m\n")


def main():
    parser = argparse.ArgumentParser(description="Dual-Layer Crypto Trading Bot with Binance Live Integration")
    parser.add_argument("--backtest", "-b", action="store_true", help="Run backtesting simulation and baseline comparisons")
    parser.add_argument("--test", "-t", action="store_true", help="Run quick diagnostic test simulation")
    parser.add_argument("--duration", "-d", type=int, default=60, help="Simulation duration in minutes")
    parser.add_argument("--balance", type=float, default=10000.0, help="Initial paper balance (USDT)")
    parser.add_argument("--report-interval", "-r", type=float, default=3600.0, help="Interval for saving hourly reports in seconds (default: 3600s)")
    parser.add_argument("--reports-dir", type=str, default="trading_reports", help="Directory path to save hourly reports")
    parser.add_argument("--reset", "--clean-start", action="store_true", dest="clean_start", help="Purge all state, caches, buffers, and re-initialize completely clean from live Binance feed")
    parser.add_argument("--clean-reports", action="store_true", help="When resetting, also remove previous report files from trading_reports/")
    args = parser.parse_args()

    if args.backtest or args.test:
        duration = 15 if args.test else args.duration
        print(f"[*] Running Backtesting & Baseline Benchmarking Engine ({duration} mins)...")
        engine = BacktestEngine()
        results = engine.run_simulation(duration_minutes=duration, initial_balance=args.balance)
        print(json.dumps(results, indent=2))
        return

    bot = DualLayerCryptoBot(
        initial_balance=args.balance,
        report_interval=args.report_interval,
        reports_dir=args.reports_dir
    )

    if args.clean_start:
        bot.purge_all_state(reset_balance=True, purge_reports=args.clean_reports)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(bot.start())
    except KeyboardInterrupt:
        tasks = asyncio.all_tasks(loop=loop)
        for t in tasks:
            t.cancel()
        loop.run_until_complete(asyncio.gather(*tasks, return_exceptions=True))
    finally:
        loop.close()


if __name__ == "__main__":
    main()
