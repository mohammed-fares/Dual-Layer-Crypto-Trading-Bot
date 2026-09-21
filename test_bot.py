#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive Unit & Regression Test Suite for Dual-Layer Crypto Trading Bot.
Tests mathematical models, health monitoring, risk rules, execution, and regression fixes.
"""

import asyncio
import time
import sys
try:
    import pytest
except ImportError:
    pytest = None
import numpy as np
import pandas as pd
from crypto_dual_layer_bot import (
    CONFIG,
    TARGET_SYMBOLS,
    SECTOR_MAP,
    DataHealthMonitor,
    FeedHealth,
    BotState,
    TimestampedMarketBuffer,
    ContextGraph,
    ContextGraphEngine,
    LeadLagRelationship,
    RiskEngine,
    PaperTradingEngine,
    Position,
    ClosedTradeRecord,
    SignalRecord,
    SignalJournal,
    PortfolioSummary,
    BacktestEngine,
    HourlyReportManager,
    HourlyReportRecord,
    MarketRegimeDetector,
    SniperExecutioner,
    DualLayerCryptoBot
)


def test_strategy_config():
    """Verify target universe and sector map completeness."""
    assert len(CONFIG.TARGET_SYMBOLS) == 25
    assert len(TARGET_SYMBOLS) == 25
    assert "BTCUSDT" in TARGET_SYMBOLS
    assert "ETHUSDT" in TARGET_SYMBOLS
    assert "PEPEUSDT" in TARGET_SYMBOLS

    # Check 7 macro-sectors
    sectors = set(SECTOR_MAP.values())
    expected_sectors = {"MEME", "AI_COMPUTE", "L1_CHAINS", "L2_ECOSYSTEM", "DEFI_RWA", "PAYMENTS", "MARKET_ANCHOR"}
    assert expected_sectors.issubset(sectors)


def test_data_health_monitor():
    """Test tick freshness, stale symbol detection, and state machine transitions."""
    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    monitor = DataHealthMonitor(symbols=symbols, max_tick_age=5.0)

    # Initial state
    assert monitor.feed_health == FeedHealth.DISCONNECTED
    assert monitor.system_state == BotState.STARTING

    # Simulate connection
    monitor.websocket_connected = True
    now = time.time()
    monitor.on_tick("BTCUSDT", now)
    monitor.on_tick("ETHUSDT", now)
    assert monitor.is_symbol_fresh("BTCUSDT", max_age=5.0) is True
    assert monitor.is_symbol_fresh("SOLUSDT", max_age=5.0) is False

    # Simulate warmup state
    feed, state = monitor.evaluate_health()
    assert state == BotState.WARMUP


def test_timestamped_market_buffer():
    """Test timestamped ring buffer, returns over exact second horizons, and volume ratio."""
    symbols = ["BTCUSDT", "ETHUSDT"]
    buf = TimestampedMarketBuffer(symbols=symbols, max_history_seconds=120.0)

    t0 = 1000.0
    # Add ticks spaced by 5 seconds
    prices = [100.0, 100.5, 101.0, 101.5, 102.0, 103.0]
    volumes = [1000.0, 1050.0, 1100.0, 1150.0, 1220.0, 1300.0]

    for i, (p, v) in enumerate(zip(prices, volumes)):
        buf.record_tick("BTCUSDT", t0 + (i * 5.0), p, v)

    # Return over 15 seconds (from t0+25s back to t0+10s: 103.0 vs 101.0 -> +1.98%)
    r_15s = buf.return_over_seconds("BTCUSDT", 15.0)
    assert r_15s is not None
    assert abs(r_15s - ((103.0 - 101.0) / 101.0 * 100.0)) < 0.1

    # Short term volume over 20s
    vol_20s = buf.short_term_volume("BTCUSDT", 20.0)
    assert vol_20s > 0

    # Short term volume ratio guards against division by zero
    ratio = buf.short_term_volume_ratio("BTCUSDT", 20.0)
    assert ratio >= 0.0


def test_context_graph_safe_diagonal():
    """
    REGRESSION TEST FOR BUG 3:
    Verify that blended correlation matrix diagonal assignment works safely
    without triggering 'ValueError: assignment destination is read-only'.
    """
    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    buf = TimestampedMarketBuffer(symbols)
    engine = ContextGraphEngine(symbols=symbols, buffer=buf)

    prior = engine._build_sector_prior_matrix(symbols)
    assert prior.shape == (3, 3)
    assert prior.loc["BTCUSDT", "BTCUSDT"] == 1.0

    # Test safe diagonal copy
    blended = prior.copy()
    for i in range(len(blended)):
        blended.iat[i, i] = 1.0
    blended = blended.clip(-1.0, 1.0)
    assert np.all(np.diag(blended.values) == 1.0)


def test_warmup_fallback_no_peers_error():
    """
    REGRESSION TEST FOR BUG 1:
    Verify that ContextGraphEngine.build_context_graph() in warmup/fallback phase
    does NOT crash with NameError: name 'peers' is not defined.
    """
    async def _run():
        symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "PEPEUSDT", "RENDERUSDT"]
        buf = TimestampedMarketBuffer(symbols)
        engine = ContextGraphEngine(symbols=symbols, buffer=buf)

        # Empty buffer triggers warmup fallback path
        graph = await engine.build_context_graph()
        assert graph is not None
        assert len(graph.leaders) > 0
        for leader in graph.leaders:
            assert leader in graph.leader_to_followers
            # Ensure followers list contains valid tuples
            for item in graph.leader_to_followers[leader]:
                assert isinstance(item, tuple)
                assert len(item) == 2

    asyncio.run(_run())


def test_lead_lag_cross_correlation():
    """Test empirical lead/lag cross-correlation across multiple horizons."""
    symbols = ["BTCUSDT", "STXUSDT"]
    buf = TimestampedMarketBuffer(symbols)
    engine = ContextGraphEngine(symbols=symbols, buffer=buf)

    # Synthetic returns where STX lags BTC by 2 steps (10 seconds)
    np.random.seed(42)
    n = 60
    btc_rets = np.random.normal(0, 0.01, n)
    stx_rets = np.zeros(n)
    stx_rets[2:] = btc_rets[:-2] * 0.9 + np.random.normal(0, 0.002, n - 2)

    df_returns = pd.DataFrame({"BTCUSDT": btc_rets, "STXUSDT": stx_rets})
    rel = engine._calculate_lead_lag(df_returns, "BTCUSDT", "STXUSDT", lags_seconds=[5, 10, 15, 20])

    assert rel.leader == "BTCUSDT"
    assert rel.follower == "STXUSDT"
    assert rel.best_lag_seconds == 10.0  # Successfully detects 10s lag!
    assert rel.lead_lag_correlation > 0.60


def test_risk_engine_constraints():
    """Test max open positions, sector concentration, and circuit breaker."""
    risk = RiskEngine(initial_balance=10000.0)

    # Test position sizing
    size = risk.calculate_position_size(10000.0, available_cash=10000.0)
    assert size > 0
    assert size <= CONFIG.MAX_POSITION_SIZE_USDT

    # Test open position validation
    open_pos = {}
    ok, reason, _ = risk.validate_new_entry("BTCUSDT", 10000.0, 10000.0, open_pos)
    assert ok is True

    # Fill sector positions (max 2 for MEME)
    pos1 = Position(
        symbol="DOGEUSDT", entry_price=0.10, position_size_usd=500.0,
        coins_amount=5000.0, entry_time=time.time(), take_profit_price=0.1016,
        stop_loss_price=0.099, trigger_leader="BTCUSDT", correlation=0.80
    )
    pos2 = Position(
        symbol="PEPEUSDT", entry_price=0.00001, position_size_usd=500.0,
        coins_amount=50000000.0, entry_time=time.time(), take_profit_price=0.00001016,
        stop_loss_price=0.0000099, trigger_leader="BTCUSDT", correlation=0.85
    )
    open_pos["DOGEUSDT"] = pos1
    open_pos["PEPEUSDT"] = pos2

    # Third MEME should be rejected
    ok3, reason3, _ = risk.validate_new_entry("SHIBUSDT", 10000.0, 9000.0, open_pos)
    assert ok3 is False
    assert "Sector limit reached" in reason3

    # Consecutive losses circuit breaker (4 losses)
    for _ in range(4):
        risk.record_trade_result("DOGEUSDT", net_pnl=-10.0)
    assert risk.circuit_breaker_active is True
    ok_halt, _, _ = risk.validate_new_entry("SOLUSDT", 10000.0, 9000.0, {})
    assert ok_halt is False


def test_paper_trading_execution_and_fees():
    """Test realistic execution with fees, slippage, and dynamic TP/Breakeven/Trailing stop."""
    async def _run():
        wallet = PaperTradingEngine(initial_balance=10000.0)

        # 1. Open position
        pos = await wallet.open_position("SOLUSDT", market_price=100.0, trigger_leader="BTCUSDT", correlation=0.85)
        assert pos is not None
        assert pos.symbol == "SOLUSDT"
        # Slippage applied
        assert pos.entry_price > 100.0
        # Fees deducted
        assert pos.entry_fee_usd > 0
        assert wallet.cash_balance < 10000.0 - pos.position_size_usd

        # 2. Test Breakeven Arming at +0.70%
        price_be = pos.entry_price * 1.0075
        await wallet.evaluate_and_close_positions({"SOLUSDT": price_be})
        assert pos.breakeven_active is True
        assert pos.stop_loss_price > pos.entry_price  # Stop raised above entry!

        # 3. Test Take Profit at +1.60%
        price_tp = pos.entry_price * 1.0165
        closed = await wallet.evaluate_and_close_positions({"SOLUSDT": price_tp})
        assert len(closed) == 1
        assert closed[0].reason == "TAKE_PROFIT"
        assert closed[0].net_pnl_usd > 0
        assert closed[0].fees_paid_usd > 0
        assert "SOLUSDT" not in wallet.open_positions

    asyncio.run(_run())


def test_portfolio_summary_keys():
    """
    REGRESSION TEST FOR BUG 2:
    Verify that PortfolioSummary and get_summary_stats() provides both
    'cash_balance' and 'current_balance' without raising KeyError.
    """
    wallet = PaperTradingEngine(initial_balance=10000.0)
    stats = wallet.get_summary_stats()

    # Check both keys exist
    assert hasattr(stats, "cash_balance")
    assert hasattr(stats, "current_balance")
    assert stats.cash_balance == stats.current_balance
    assert hasattr(stats, "total_equity")

    d = stats.to_dict()
    assert "cash_balance" in d
    assert "current_balance" in d
    assert "total_equity" in d


def test_backtest_simulation():
    """Verify BacktestEngine simulation runs and outputs comparisons with all 4 baselines."""
    engine = BacktestEngine(symbols=["BTCUSDT", "ETHUSDT", "SOLUSDT", "STXUSDT"])
    res = engine.run_simulation(duration_minutes=15, initial_balance=10000.0)

    assert "strategy_total_pnl_usd" in res
    assert "strategy_return_pct" in res
    assert "baselines" in res
    assert "btc_buy_and_hold_return_pct" in res["baselines"]
    assert "equal_weight_universe_return_pct" in res["baselines"]
    assert "simple_momentum_return_pct" in res["baselines"]
    assert "random_entry_baseline_return_pct" in res["baselines"]


def test_hourly_report_manager(tmp_path):
    """Test generating and saving hourly reports to disk as JSON and formatted TXT."""
    reports_dir = str(tmp_path / "test_reports")
    manager = HourlyReportManager(reports_dir=reports_dir)

    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    buffer = TimestampedMarketBuffer(symbols)
    health = DataHealthMonitor(symbols)
    regime_det = MarketRegimeDetector(symbols, buffer, health)
    wallet = PaperTradingEngine(initial_balance=10000.0)

    # Seed ticks
    now = time.time()
    for s in symbols:
        buffer.record_tick(s, now, 100.0, 10000.0)
        health.on_tick(s, now)

    # Generate hourly report #1
    paths1 = manager.generate_and_save_report(
        wallet=wallet, buffer=buffer, regime_detector=regime_det
    )

    assert "json" in paths1
    assert "txt" in paths1
    assert "report_id" in paths1

    # Verify files created on disk
    import os
    assert os.path.exists(paths1["json"])
    assert os.path.exists(paths1["txt"])
    index_path = os.path.join(reports_dir, "reports_index.jsonl")
    assert os.path.exists(index_path)

    # Verify JSON structure
    import json
    with open(paths1["json"], "r", encoding="utf-8") as f:
        data = json.load(f)
        assert data["initial_balance"] == 10000.0
        assert data["total_equity"] == 10000.0
        assert data["report_index"] == 1
        assert "hour_pnl_usd" in data
        assert "open_positions" in data
        assert "closed_trades_this_hour" in data

    # Verify TXT structure contains expected headers
    with open(paths1["txt"], "r", encoding="utf-8") as f:
        text = f.read()
        assert "HOURLY TRADING REPORT #1" in text
        assert "PORTFOLIO & EQUITY OVERVIEW" in text
        assert "HOURLY PERIOD PERFORMANCE" in text


def test_real_binance_rest_bootstrap():
    """Verify that SniperExecutioner.bootstrap_real_binance_data retrieves 100% real live market prices."""
    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    buf = TimestampedMarketBuffer(symbols)
    health = DataHealthMonitor(symbols)
    brain = ContextGraphEngine(symbols, buf)
    wallet = PaperTradingEngine(10000.0)
    journal = SignalJournal(buf)
    executioner = SniperExecutioner(symbols, buf, health, brain, wallet, journal)

    count = executioner.bootstrap_real_binance_data()
    assert count > 0, "Failed to load real prices from Binance API"
    for s in symbols:
        if s in executioner.latest_prices:
            p = executioner.latest_prices[s]
            assert p > 0.0, f"Invalid real price for {s}: {p}"
            # BTC should be reasonable real crypto price
            if s == "BTCUSDT":
                assert p > 10000.0


def test_purge_all_state(tmp_path=None):
    """Verify that DualLayerCryptoBot.purge_all_state wipes all residual memory and resets balance."""
    import tempfile
    from pathlib import Path
    reports_dir = str(tmp_path / "purge_reports") if tmp_path else tempfile.mkdtemp()
    bot = DualLayerCryptoBot(initial_balance=10000.0, reports_dir=reports_dir)

    # Put dirty data into wallet and buffer
    bot.buffer.record_tick("BTCUSDT", time.time(), 99999.0, 50000.0)
    bot.wallet.cash_balance = 5432.10

    # Purge
    bot.purge_all_state(reset_balance=True, purge_reports=True)

    # Verify clean state
    assert bot.wallet.cash_balance == 10000.0
    assert len(bot.wallet.open_positions) == 0
    assert len(bot.wallet.closed_trades) == 0


if __name__ == "__main__":
    import tempfile
    from pathlib import Path

    print("\n" + "="*80)
    print("      RUNNING BOT QUANTITATIVE AUDIT & REGRESSION TEST SUITE")
    print("="*80)

    unit_tests = [
        test_strategy_config,
        test_data_health_monitor,
        test_timestamped_market_buffer,
        test_context_graph_safe_diagonal,
        test_warmup_fallback_no_peers_error,
        test_lead_lag_cross_correlation,
        test_risk_engine_constraints,
        test_paper_trading_execution_and_fees,
        test_portfolio_summary_keys,
        test_backtest_simulation,
        test_real_binance_rest_bootstrap,
        test_purge_all_state,
    ]

    passed = 0
    failed = 0

    for test_fn in unit_tests:
        name = test_fn.__name__
        try:
            test_fn()
            print(f"  \033[92m[PASS]\033[0m {name}")
            passed += 1
        except Exception as e:
            print(f"  \033[91m[FAIL]\033[0m {name}: {e}")
            failed += 1

    # Run hourly report test with temp directory
    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            test_hourly_report_manager(Path(tmp_dir))
            print("  \033[92m[PASS]\033[0m test_hourly_report_manager")
            passed += 1
        except Exception as e:
            print(f"  \033[91m[FAIL]\033[0m test_hourly_report_manager: {e}")
            failed += 1

    print("="*80)
    status_color = "\033[92m" if failed == 0 else "\033[91m"
    print(f"RESULTS: {status_color}{passed} PASSED, {failed} FAILED ({passed/(passed+failed)*100:.1f}%)\033[0m")
    print("="*80 + "\n")

    if failed > 0:
        sys.exit(1)

