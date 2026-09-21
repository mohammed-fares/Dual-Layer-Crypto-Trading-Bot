import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { HourlyTradingReport } from '../types';
import { TrendingUp, TrendingDown, Maximize2, Activity, Clock, ShieldCheck, Zap } from 'lucide-react';

interface EquityPoint {
  timestamp: number;
  label: string;
  equity: number;
  pnlUsd: number;
  pnlPct: number;
  isLive?: boolean;
  isReport?: boolean;
  reportNumber?: number;
}

interface EquityGrowthChartProps {
  reports: HourlyTradingReport[];
  currentEquity: number;
  initialBalance: number;
  peakEquity?: number;
}

export const EquityGrowthChart: React.FC<EquityGrowthChartProps> = ({
  reports,
  currentEquity,
  initialBalance,
  peakEquity: externalPeakEquity,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 280,
  });
  const [hoveredPoint, setHoveredPoint] = useState<EquityPoint | null>(null);
  const [showPeakLine, setShowPeakLine] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);

  // Observe container size using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({
            width,
            height: Math.max(260, Math.min(340, Math.round(width * 0.38))),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build time-series points
  const points: EquityPoint[] = useMemo(() => {
    const list: EquityPoint[] = [];
    const now = Date.now();

    // Baseline point at session start
    const startTime = reports.length > 0 ? reports[0].timestamp - 3600000 : now - 3600000;
    list.push({
      timestamp: startTime,
      label: 'Session Start (البداية)',
      equity: initialBalance,
      pnlUsd: 0,
      pnlPct: 0,
    });

    // Add each hourly report
    reports.forEach((r) => {
      list.push({
        timestamp: r.timestamp,
        label: `Report #${r.reportNumber} (${r.timeFormatted})`,
        equity: r.totalEquity,
        pnlUsd: r.totalPnlUsd,
        pnlPct: r.totalPnlPct,
        isReport: true,
        reportNumber: r.reportNumber,
      });
    });

    // Append current live point
    list.push({
      timestamp: now,
      label: 'الآن (Live NAV)',
      equity: currentEquity,
      pnlUsd: currentEquity - initialBalance,
      pnlPct: initialBalance > 0 ? ((currentEquity - initialBalance) / initialBalance) * 100 : 0,
      isLive: true,
    });

    // Sort by timestamp
    list.sort((a, b) => a.timestamp - b.timestamp);
    return list;
  }, [reports, currentEquity, initialBalance]);

  // Calculate statistics
  const currentNav = currentEquity;
  const totalReturnUsd = currentNav - initialBalance;
  const totalReturnPct = initialBalance > 0 ? (totalReturnUsd / initialBalance) * 100 : 0;
  const peak = Math.max(
    initialBalance,
    externalPeakEquity || 0,
    ...points.map((p) => p.equity)
  );
  const drawdownPct = peak > 0 ? ((peak - currentNav) / peak) * 100 : 0;

  // Render D3 chart
  useEffect(() => {
    if (!svgRef.current || points.length < 2 || dimensions.width <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 25, right: 30, bottom: 35, left: 65 };
    const innerWidth = Math.max(10, dimensions.width - margin.left - margin.right);
    const innerHeight = Math.max(10, dimensions.height - margin.top - margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define defs (gradients & glow filters)
    const defs = svg.append('defs');

    // Area Gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'equity-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    const isPositive = totalReturnUsd >= 0;
    const primaryColor = isPositive ? '#10b981' : '#f43f5e'; // emerald-500 or rose-500
    const secondaryColor = isPositive ? '#06b6d4' : '#fb7185'; // cyan-500 or rose-400

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.28);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', primaryColor)
      .attr('stop-opacity', 0.0);

    // Line Gradient
    const lineGradient = defs
      .append('linearGradient')
      .attr('id', 'equity-line-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    lineGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', secondaryColor);

    lineGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', primaryColor);

    // Scales
    const xExtent = d3.extent(points, (d) => d.timestamp) as [number, number];
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

    const minEquity = Math.min(...points.map((p) => p.equity), initialBalance);
    const maxEquity = Math.max(...points.map((p) => p.equity), peak, initialBalance);
    const yPadding = Math.max(20, (maxEquity - minEquity) * 0.15);

    const yScale = d3
      .scaleLinear()
      .domain([minEquity - yPadding, maxEquity + yPadding])
      .range([innerHeight, 0])
      .nice();

    // Grid lines (horizontal)
    const yTicks = yScale.ticks(5);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1);

    // Initial Baseline reference line ($10,000)
    if (showBaseline) {
      const baselineY = yScale(initialBalance);
      if (baselineY >= 0 && baselineY <= innerHeight) {
        const baselineG = g.append('g').attr('class', 'baseline-group');
        baselineG
          .append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', baselineY)
          .attr('y2', baselineY)
          .attr('stroke', '#64748b')
          .attr('stroke-dasharray', '4,4')
          .attr('stroke-width', 1.2);

        baselineG
          .append('text')
          .attr('x', innerWidth - 6)
          .attr('y', baselineY - 4)
          .attr('text-anchor', 'end')
          .attr('fill', '#94a3b8')
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(`Base: $${initialBalance.toLocaleString()}`);
      }
    }

    // High-Water Mark (Peak Equity) reference line
    if (showPeakLine && peak > initialBalance) {
      const peakY = yScale(peak);
      if (peakY >= 0 && peakY <= innerHeight) {
        const peakG = g.append('g').attr('class', 'peak-group');
        peakG
          .append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', peakY)
          .attr('y2', peakY)
          .attr('stroke', '#f59e0b')
          .attr('stroke-dasharray', '5,3')
          .attr('stroke-width', 1.2);

        peakG
          .append('text')
          .attr('x', 6)
          .attr('y', peakY - 4)
          .attr('text-anchor', 'start')
          .attr('fill', '#f59e0b')
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(`Peak ATH: $${peak.toFixed(2)}`);
      }
    }

    // Area Generator
    const areaGenerator = d3
      .area<EquityPoint>()
      .x((d) => xScale(d.timestamp))
      .y0(innerHeight)
      .y1((d) => yScale(d.equity))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(points)
      .attr('fill', 'url(#equity-area-gradient)')
      .attr('d', areaGenerator);

    // Line Generator
    const lineGenerator = d3
      .line<EquityPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.equity))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', 'url(#equity-line-gradient)')
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator);

    // Data points (dots for hourly reports and live)
    g.selectAll('.data-dot')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'data-dot')
      .attr('cx', (d) => xScale(d.timestamp))
      .attr('cy', (d) => yScale(d.equity))
      .attr('r', (d) => (d.isLive ? 5 : d.isReport ? 4 : 3))
      .attr('fill', (d) => (d.isLive ? primaryColor : d.isReport ? '#38bdf8' : '#94a3b8'))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer');

    // Axes
    // X-Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 110)))
      .tickFormat((d) => d3.timeFormat('%H:%M')(d as Date));

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', '#334155');
    xAxisG.selectAll('.tick line').attr('stroke', '#334155');
    xAxisG
      .selectAll('.tick text')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Y-Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `$${d3.format(',.0f')(d as number)}`);

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').attr('stroke', '#334155');
    yAxisG.selectAll('.tick line').attr('stroke', '#334155');
    yAxisG
      .selectAll('.tick text')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Interactive Hover Overlay with bisector
    const bisect = d3.bisector<EquityPoint, number>((d) => d.timestamp).center;

    const crosshair = g.append('g').attr('class', 'crosshair').style('display', 'none');

    const verticalLine = crosshair
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#94a3b8')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 1.2);

    const focusCircle = crosshair
      .append('circle')
      .attr('r', 6)
      .attr('fill', primaryColor)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Transparent overlay rectangle to capture pointer events
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mouseenter', () => {
        crosshair.style('display', null);
      })
      .on('mouseleave', () => {
        crosshair.style('display', 'none');
        setHoveredPoint(null);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx).getTime();
        const index = bisect(points, x0);
        const point = points[index];
        if (point) {
          const cx = xScale(point.timestamp);
          const cy = yScale(point.equity);

          verticalLine.attr('x1', cx).attr('x2', cx);
          focusCircle.attr('cx', cx).attr('cy', cy);
          setHoveredPoint(point);
        }
      });
  }, [points, dimensions, showPeakLine, showBaseline, totalReturnUsd, initialBalance, peak]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 shadow-xl flex flex-col gap-3"
      id="equity-growth-d3-container"
    >
      {/* Header & Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                Total Equity Growth Over Time (منحنى نمو رأس المال)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                D3 Real-Time Vector
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              رسم بياني تفاعلي متقدم مدعوم بـ D3.js يتتبع تطور القيمة الصافية للمحفظة (NAV) عبر التقارير الدورية.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowBaseline((v) => !v)}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition flex items-center gap-1 ${
              showBaseline
                ? 'bg-slate-800 text-slate-200 border-slate-600'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="إظهار/إخفاء خط رأس المال المبدئي ($10,000)"
          >
            <span className="w-2 h-0.5 bg-slate-400 inline-block" />
            Base ($10K)
          </button>

          <button
            onClick={() => setShowPeakLine((v) => !v)}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition flex items-center gap-1 ${
              showPeakLine
                ? 'bg-amber-950/50 text-amber-300 border-amber-600/40'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="إظهار/إخفاء أعلى قمة لرأس المال (ATH Peak)"
          >
            <span className="w-2 h-0.5 bg-amber-400 inline-block" />
            Peak ATH
          </button>
        </div>
      </div>

      {/* Stats KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 text-xs">
        <div>
          <span className="text-[11px] text-slate-400">Current Net Equity (NAV):</span>
          <div className="font-mono font-bold text-slate-100 text-sm">
            ${currentNav.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
          </div>
        </div>

        <div>
          <span className="text-[11px] text-slate-400">Total Return:</span>
          <div
            className={`font-mono font-bold text-sm flex items-center gap-1 ${
              totalReturnUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalReturnUsd >= 0 ? '+' : ''}${totalReturnUsd.toFixed(2)} ({totalReturnPct >= 0 ? '+' : ''}
            {totalReturnPct.toFixed(2)}%)
          </div>
        </div>

        <div>
          <span className="text-[11px] text-slate-400">Peak High-Water Mark:</span>
          <div className="font-mono font-bold text-amber-300 text-sm">
            ${peak.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
          </div>
        </div>

        <div>
          <span className="text-[11px] text-slate-400">Drawdown from Peak:</span>
          <div className="font-mono font-bold text-slate-300 text-sm flex items-center gap-1">
            <span className={drawdownPct > 0 ? 'text-rose-400' : 'text-emerald-400'}>
              -{drawdownPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-500 font-sans">
              ({reports.length} تقارير محفوظة)
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-auto select-none"
        />

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-2xl backdrop-blur text-xs flex flex-wrap items-center gap-4 pointer-events-none z-10 animate-fade-in font-mono">
            <div>
              <span className="text-slate-400 text-[10px] block">النقطة الزمنية:</span>
              <span className="font-bold text-cyan-300">{hoveredPoint.label}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400 text-[10px] block">رأس المال (Equity):</span>
              <span className="font-bold text-slate-100">
                ${hoveredPoint.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400 text-[10px] block">العائد الإجمالي:</span>
              <span
                className={`font-bold ${
                  hoveredPoint.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {hoveredPoint.pnlUsd >= 0 ? '+' : ''}${hoveredPoint.pnlUsd.toFixed(2)} (
                {hoveredPoint.pnlPct >= 0 ? '+' : ''}{hoveredPoint.pnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Notes */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
        <span>● النقطة الخضراء: القيمة اللحظية المباشرة | النقاط الزرقاء: تقارير الإغلاق الساعية</span>
        <span>تحديث تلقائي تزامناً مع تغذية بينانس اللحظية وحركات الصفقات</span>
      </div>
    </div>
  );
};
