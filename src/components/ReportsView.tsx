import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Layers, 
  Coins, 
  ArrowUpRight, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  PieChart, 
  Filter, 
  HelpCircle,
  Building,
  MapPin,
  TrendingDown,
  FileDown,
  Loader2,
  FileText,
  Eye,
  ExternalLink,
  Check,
  Sliders,
  CheckSquare,
  Square,
  X,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';
import { triggerPrint } from '../utils/print';

interface ReportsViewProps {
  plots: LandPlot[];
  settings: PortfolioSettings;
  onSelectPlot: (plot: LandPlot) => void;
}

// Helper to extract year from Thai/Gregorian date strings like "23/3/2569", "29-02-2555", "18/2/2568"
const extractYear = (dateStr?: string): string => {
  if (!dateStr || dateStr.trim() === '-' || dateStr.trim() === '') return 'ไม่ระบุปี';
  const match = dateStr.match(/(25\d{2}|20\d{2})/);
  if (match) return match[1];
  return 'ไม่ระบุปี';
};

// ==========================================
// D3 Component: Revenue Forecast vs Realized
// ==========================================
interface RevenueForecastChartProps {
  plots: LandPlot[];
  paperPrintMode: boolean;
  onSelectPlot?: (plot: LandPlot) => void;
}

export const RevenueForecastVsRealizedChart: React.FC<RevenueForecastChartProps> = ({
  plots,
  paperPrintMode,
  onSelectPlot,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Compute cumulative series sorted chronologically
  const chartData = useMemo(() => {
    // Sort plots by acquisition date or orderNumber
    const sorted = [...plots].sort((a, b) => {
      const parsePlotDate = (d?: string) => {
        if (!d || d === '-') return 0;
        const parts = d.split(/[/-]/);
        if (parts.length === 3) {
          let [day, month, year] = parts.map(Number);
          if (year > 2400) year -= 543;
          return new Date(year, (month || 1) - 1, day || 1).getTime() || 0;
        }
        return 0;
      };
      const tA = parsePlotDate(a.purchaseDate);
      const tB = parsePlotDate(b.purchaseDate);
      if (tA !== tB && tA > 0 && tB > 0) return tA - tB;
      return a.orderNumber - b.orderNumber;
    });

    let cumCost = 0;
    let cumForecast = 0;
    let cumRealized = 0;

    return sorted.map((p, idx) => {
      const cost = Number(p.totalCost) || 0;
      const forecast = Number(p.targetSalePrice) || 0;
      const isSold = p.status === 'sold';
      const soldAmount = isSold ? (Number(p.soldPrice) || 0) : 0;

      cumCost += cost;
      cumForecast += forecast;
      cumRealized += soldAmount;

      return {
        index: idx,
        plot: p,
        key: `plot-${p.id}-${idx}`,
        orderNumber: p.orderNumber,
        title: p.title,
        purchaseDate: p.purchaseDate || 'ไม่ระบุ',
        saleDate: p.saleDate || '',
        status: p.status,
        isSold,
        cost,
        forecast,
        soldAmount,
        cumCost,
        cumForecast,
        cumRealized,
        profitForecast: cumForecast - cumCost,
        profitRealized: cumRealized - cumCost,
      };
    });
  }, [plots]);

  // Overall chart summary metrics
  const totals = useMemo(() => {
    if (chartData.length === 0) {
      return { totalForecast: 0, totalRealized: 0, totalCost: 0, soldCount: 0, totalCount: 0, pct: 0 };
    }
    const last = chartData[chartData.length - 1];
    const soldCount = chartData.filter((d) => d.isSold).length;
    const pct = last.cumForecast > 0 ? (last.cumRealized / last.cumForecast) * 100 : 0;
    return {
      totalForecast: last.cumForecast,
      totalRealized: last.cumRealized,
      totalCost: last.cumCost,
      soldCount,
      totalCount: chartData.length,
      pct,
    };
  }, [chartData]);

  // D3 Render effect
  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 860;
    const height = 340;
    const margin = { top: 30, right: 35, bottom: 65, left: 85 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate maximum Y value
    const maxY = Math.max(
      d3.max(chartData, (d) => Math.max(d.cumForecast, d.cumRealized, d.cumCost)) || 1000000,
      1000000
    );

    const xScale = d3
      .scalePoint<string>()
      .domain(chartData.map((d) => d.key))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3
      .scaleLinear()
      .domain([0, maxY * 1.12])
      .range([innerHeight, 0])
      .nice();

    // Horizontal Grid lines
    const yAxisGrid = d3.axisLeft(yScale)
      .tickSize(-innerWidth)
      .tickFormat(() => '')
      .ticks(5);

    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .call((grid) => {
        grid.select('.domain').remove();
        grid.selectAll('.tick line')
          .attr('stroke', paperPrintMode ? '#cbd5e1' : '#334155')
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-opacity', paperPrintMode ? 0.8 : 0.4);
      });

    // Area Fill for Forecast
    const areaForecast = d3.area<typeof chartData[0]>()
      .x((d) => xScale(d.key) ?? 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.cumForecast))
      .curve(d3.curveMonotoneX);

    // Area Fill for Realized
    const areaRealized = d3.area<typeof chartData[0]>()
      .x((d) => xScale(d.key) ?? 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.cumRealized))
      .curve(d3.curveMonotoneX);

    if (!paperPrintMode) {
      const defs = svg.append('defs');
      
      const gradForecast = defs.append('linearGradient')
        .attr('id', 'd3-grad-forecast')
        .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
      gradForecast.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.22);
      gradForecast.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.0);

      const gradRealized = defs.append('linearGradient')
        .attr('id', 'd3-grad-realized')
        .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
      gradRealized.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.35);
      gradRealized.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

      g.append('path')
        .datum(chartData)
        .attr('fill', 'url(#d3-grad-forecast)')
        .attr('d', areaForecast);

      g.append('path')
        .datum(chartData)
        .attr('fill', 'url(#d3-grad-realized)')
        .attr('d', areaRealized);
    }

    // Line Generators
    const lineCost = d3.line<typeof chartData[0]>()
      .x((d) => xScale(d.key) ?? 0)
      .y((d) => yScale(d.cumCost))
      .curve(d3.curveMonotoneX);

    const lineForecast = d3.line<typeof chartData[0]>()
      .x((d) => xScale(d.key) ?? 0)
      .y((d) => yScale(d.cumForecast))
      .curve(d3.curveMonotoneX);

    const lineRealized = d3.line<typeof chartData[0]>()
      .x((d) => xScale(d.key) ?? 0)
      .y((d) => yScale(d.cumRealized))
      .curve(d3.curveMonotoneX);

    // 1. Draw Cumulative Cost Line (Amber / Slate)
    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', paperPrintMode ? '#475569' : '#f59e0b')
      .attr('stroke-width', paperPrintMode ? 2 : 2.5)
      .attr('stroke-dasharray', '5,4')
      .attr('d', lineCost);

    // 2. Draw Revenue Forecast Line (Blue / Sky)
    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', paperPrintMode ? '#0f172a' : '#38bdf8')
      .attr('stroke-width', paperPrintMode ? 2.5 : 3)
      .attr('d', lineForecast);

    // 3. Draw Realized Revenue Line (Emerald / Pure Black on Paper)
    // DYNAMIC: Immediately tracks sold plots!
    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', paperPrintMode ? '#000000' : '#10b981')
      .attr('stroke-width', paperPrintMode ? 3.5 : 3.5)
      .attr('d', lineRealized);

    // Data Markers & Dots
    chartData.forEach((d) => {
      const x = xScale(d.key) ?? 0;

      // Cost marker
      g.append('circle')
        .attr('cx', x)
        .attr('cy', yScale(d.cumCost))
        .attr('r', 3)
        .attr('fill', paperPrintMode ? '#ffffff' : '#f59e0b')
        .attr('stroke', paperPrintMode ? '#475569' : '#b45309')
        .attr('stroke-width', 1.5);

      // Forecast marker
      g.append('circle')
        .attr('cx', x)
        .attr('cy', yScale(d.cumForecast))
        .attr('r', 4)
        .attr('fill', paperPrintMode ? '#ffffff' : '#0284c7')
        .attr('stroke', paperPrintMode ? '#0f172a' : '#38bdf8')
        .attr('stroke-width', 2);

      // Realized marker: Larger and prominent if plot is sold!
      const isSold = d.isSold;
      g.append('circle')
        .attr('cx', x)
        .attr('cy', yScale(d.cumRealized))
        .attr('r', isSold ? 6 : 3.5)
        .attr('fill', isSold ? (paperPrintMode ? '#000000' : '#10b981') : (paperPrintMode ? '#cbd5e1' : '#064e3b'))
        .attr('stroke', paperPrintMode ? '#000000' : '#ffffff')
        .attr('stroke-width', isSold ? 2 : 1.5);
    });

    // X Axis
    const xAxis = d3.axisBottom(xScale)
      .tickFormat((d) => {
        const item = chartData.find((it) => it.key === d);
        if (!item) return '';
        const shortTitle = item.title.length > 7 ? item.title.slice(0, 7) + '..' : item.title;
        return `#${item.orderNumber} ${shortTitle}`;
      });

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain')
      .attr('stroke', paperPrintMode ? '#334155' : '#475569');

    xAxisG.selectAll('.tick text')
      .attr('transform', 'rotate(-32)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.6em')
      .attr('font-size', '9.5px')
      .attr('font-family', 'Sarabun, Prompt, sans-serif')
      .attr('fill', paperPrintMode ? '#0f172a' : '#94a3b8');

    // Y Axis in Thai Baht Millions
    const formatYAxis = (d: d3.NumberValue) => {
      const val = Number(d);
      if (val === 0) return '0 ฿';
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(val % 1000000 === 0 ? 0 : 1)}M ฿`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(0)}k ฿`;
      }
      return `${val} ฿`;
    };

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(formatYAxis);

    const yAxisG = g.append('g').call(yAxis);

    yAxisG.select('.domain')
      .attr('stroke', paperPrintMode ? '#334155' : '#475569');

    yAxisG.selectAll('.tick text')
      .attr('font-size', '10px')
      .attr('font-family', 'Sarabun, Prompt, monospace')
      .attr('font-weight', '600')
      .attr('fill', paperPrintMode ? '#0f172a' : '#94a3b8');

    // Interactive Overlay for Tooltip Tracking
    const overlay = g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mouseX] = d3.pointer(event);
      let closest = chartData[0];
      let minDist = Infinity;
      chartData.forEach((d) => {
        const x = xScale(d.key) ?? 0;
        const dist = Math.abs(x - mouseX);
        if (dist < minDist) {
          minDist = dist;
          closest = d;
        }
      });

      if (closest) {
        const xPos = (xScale(closest.key) ?? 0) + margin.left;
        setHoverPosition({ x: xPos, y: event.clientY });
        setHoveredPoint(closest);
      }
    });

    overlay.on('mouseleave', () => {
      setHoveredPoint(null);
      setHoverPosition(null);
    });

  }, [chartData, paperPrintMode]);

  return (
    <div className={`p-5 rounded-xl border space-y-4 shadow-sm ${
      paperPrintMode
        ? 'bg-white border-2 border-slate-300 text-slate-900'
        : 'bg-slate-900 border-slate-800 text-slate-100'
    }`}>
      {/* Header & Dynamic Live Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-sm sm:text-base flex items-center gap-2 ${
              paperPrintMode ? 'text-slate-950 font-extrabold' : 'text-white'
            }`}>
              <TrendingUp className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
              กราฟเป้ารายได้สะสมเทียบยอดขายจริง (Revenue Forecast vs Realized)
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              paperPrintMode
                ? 'bg-slate-100 text-slate-900 border-slate-300'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              D3 Engine Live
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${paperPrintMode ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
            กราฟจำลองแนวโน้มการแปลงสินทรัพย์เป็นเงินสด อัปเดตเส้นรายได้จริงสะสมอัตโนมัติทันทีที่มีการบันทึกขายแปลงที่ดิน
          </p>
        </div>

        {/* Dynamic Realized Counter Pill */}
        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-mono ${
          paperPrintMode 
            ? 'bg-slate-50 border-slate-400 text-slate-950' 
            : 'bg-slate-800/80 border-slate-700 text-slate-200'
        }`}>
          <span className="font-semibold">ขายแล้ว:</span>
          <span className={`font-bold ${paperPrintMode ? 'text-slate-950 underline' : 'text-emerald-400'}`}>
            {totals.soldCount} / {totals.totalCount} แปลง
          </span>
          <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
            totals.pct > 0 ? (paperPrintMode ? 'bg-slate-200 text-slate-950' : 'bg-emerald-500/20 text-emerald-300') : 'text-slate-500'
          }`}>
            {totals.pct.toFixed(1)}% ของเป้า
          </span>
        </div>
      </div>

      {/* KPI 3-Column Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className={`p-3 rounded-lg border ${
          paperPrintMode ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={paperPrintMode ? 'text-slate-700 font-semibold' : 'text-sky-400 font-medium'}>
              🔵 เป้าหมายรายได้สะสม (Forecast Target)
            </span>
          </div>
          <div className={`text-lg sm:text-xl font-mono font-extrabold mt-1 ${
            paperPrintMode ? 'text-slate-950' : 'text-white'
          }`}>
            {formatCurrency(totals.totalForecast)}
          </div>
          <div className={`text-[11px] ${paperPrintMode ? 'text-slate-600' : 'text-slate-400'}`}>
            ราคาตั้งใจขายรวมทุกแปลงในรายงาน
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${
          paperPrintMode ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={paperPrintMode ? 'text-slate-900 font-bold' : 'text-emerald-400 font-medium'}>
              🟢 ยอดขายจริงสะสม (Realized Revenue)
            </span>
          </div>
          <div className={`text-lg sm:text-xl font-mono font-extrabold mt-1 ${
            paperPrintMode ? 'text-slate-950' : 'text-emerald-400'
          }`}>
            {formatCurrency(totals.totalRealized)}
          </div>
          <div className={`text-[11px] ${paperPrintMode ? 'text-slate-600' : 'text-slate-400'}`}>
            รับรู้จริงแล้ว {totals.soldCount} แปลง (อัปเดตอัตโนมัติ)
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${
          paperPrintMode ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={paperPrintMode ? 'text-slate-700 font-semibold' : 'text-amber-400 font-medium'}>
              🟠 เงินลงทุนสะสม (Cumulative Capital Cost)
            </span>
          </div>
          <div className={`text-lg sm:text-xl font-mono font-extrabold mt-1 ${
            paperPrintMode ? 'text-slate-950' : 'text-amber-300'
          }`}>
            {formatCurrency(totals.totalCost)}
          </div>
          <div className={`text-[11px] ${paperPrintMode ? 'text-slate-600' : 'text-slate-400'}`}>
            ต้นทุนรวมซื้อ + ค่าธรรมเนียม + รังวัด
          </div>
        </div>
      </div>

      {/* D3 SVG Chart Container */}
      <div className="relative w-full overflow-x-auto pt-2">
        <svg
          ref={svgRef}
          className="w-full h-auto min-w-[700px] select-none"
          viewBox="0 0 860 340"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Dynamic Hover Tooltip */}
        {hoveredPoint && (
          <div
            className={`absolute top-2 z-20 pointer-events-none p-3 rounded-xl shadow-2xl border text-xs font-sans transition-all backdrop-blur-md ${
              paperPrintMode
                ? 'bg-white/95 border-2 border-slate-900 text-slate-950'
                : 'bg-slate-950/95 border border-slate-700 text-slate-100'
            }`}
            style={{
              left: Math.min(Math.max(hoverPosition?.x || 50, 40), 620),
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b pb-1 mb-2 font-bold">
              <span>#{hoveredPoint.orderNumber} {hoveredPoint.title}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                hoveredPoint.isSold 
                  ? (paperPrintMode ? 'bg-slate-200 text-slate-950' : 'bg-emerald-500/20 text-emerald-400')
                  : (paperPrintMode ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-400')
              }`}>
                {hoveredPoint.isSold ? 'ขายแล้ว (Sold)' : 'ถือครอง (Holding)'}
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between gap-4">
                <span className={paperPrintMode ? 'text-slate-700' : 'text-sky-300'}>เป้ารายได้สะสม:</span>
                <span className="font-bold">{formatCurrency(hoveredPoint.cumForecast)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className={paperPrintMode ? 'text-slate-900 font-bold' : 'text-emerald-400'}>ยอดขายจริงสะสม:</span>
                <span className={`font-bold ${paperPrintMode ? 'text-slate-950' : 'text-emerald-400'}`}>
                  {formatCurrency(hoveredPoint.cumRealized)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className={paperPrintMode ? 'text-slate-700' : 'text-amber-400'}>ต้นทุนสะสม:</span>
                <span className="font-bold">{formatCurrency(hoveredPoint.cumCost)}</span>
              </div>
              <div className="flex justify-between gap-4 pt-1 border-t">
                <span className="font-semibold">กำไรสุทธิรับรู้แล้ว:</span>
                <span className={`font-extrabold ${hoveredPoint.profitRealized >= 0 ? (paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-400') : 'text-rose-400'}`}>
                  {hoveredPoint.profitRealized >= 0 ? `+${formatCurrency(hoveredPoint.profitRealized)}` : formatCurrency(hoveredPoint.profitRealized)}
                </span>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-slate-400 font-sans border-t pt-1 flex justify-between">
              <span>วันที่ซื้อ: {hoveredPoint.purchaseDate}</span>
              {hoveredPoint.saleDate && <span>วันที่ขาย: {hoveredPoint.saleDate}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Chart Legend */}
      <div className={`flex flex-wrap items-center justify-between text-xs pt-2 border-t ${
        paperPrintMode ? 'border-slate-300 text-slate-800' : 'border-slate-800 text-slate-400'
      }`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-3.5 h-1 rounded ${paperPrintMode ? 'bg-slate-900' : 'bg-sky-400'}`} />
            <span className="font-medium">เป้ารายได้ (Forecast Target)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-3.5 h-1 rounded ${paperPrintMode ? 'bg-black' : 'bg-emerald-500'}`} />
            <span className="font-bold">ยอดขายจริง (Realized Revenue - ขายแล้ว)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-3.5 h-1 border-b-2 border-dashed ${paperPrintMode ? 'border-slate-600' : 'border-amber-400'}`} />
            <span className="font-medium">เงินลงทุนสะสม (Total Cost)</span>
          </div>
        </div>

        <div className={`text-[11px] font-mono ${paperPrintMode ? 'text-slate-700' : 'text-slate-500'}`}>
          *สร้างด้วย D3.js รองรับการขยายและการสั่งพิมพ์คมชัดระดับ Vector
        </div>
      </div>
    </div>
  );
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  plots,
  settings,
  onSelectPlot,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedLandType, setSelectedLandType] = useState<string>('all');
  const [reportSubTab, setReportSubTab] = useState<'forecast' | 'landType' | 'timeline' | 'performance'>('forecast');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccessToast, setPdfSuccessToast] = useState<string | null>(null);
  // Default to Paper / Monochrome-friendly High Contrast Mode for black ink printing
  const [paperPrintMode, setPaperPrintMode] = useState<boolean>(true);
  const reportRef = useRef<HTMLDivElement>(null);

  // Print Configuration Modal state (allowing customizable plot scopes and report sections)
  const [isPrintConfigModalOpen, setIsPrintConfigModalOpen] = useState<boolean>(false);
  const [reportPlotScope, setReportPlotScope] = useState<'all' | 'filtered' | 'selected'>('filtered');
  const [selectedReportPlotIds, setSelectedReportPlotIds] = useState<string[]>([]);
  const [reportSections, setReportSections] = useState({
    executiveSummary: true,
    d3Chart: true,
    landType: true,
    timeline: true,
    performance: true,
    insights: true,
  });

  // Extract all distinct years present in the dataset and sort them chronologically
  const allYears = useMemo(() => {
    const set = new Set<string>();
    plots.forEach((p) => {
      const y = extractYear(p.purchaseDate);
      if (y !== 'ไม่ระบุปี') set.add(y);
    });
    return Array.from(set).sort((a, b) => parseInt(a) - parseInt(b));
  }, [plots]);

  const allLandTypes = useMemo(() => {
    const set = new Set<string>();
    plots.forEach((p) => {
      if (p.landType) set.add(p.landType.trim());
    });
    return Array.from(set);
  }, [plots]);

  // Filter plots based on selected year and type
  const filteredPlots = useMemo(() => {
    return plots.filter((p) => {
      const plotYear = extractYear(p.purchaseDate);
      const matchYear = selectedYear === 'all' || plotYear === selectedYear;
      const matchType = selectedLandType === 'all' || p.landType === selectedLandType;
      return matchYear && matchType;
    });
  }, [plots, selectedYear, selectedLandType]);

  // Sync selectedReportPlotIds if empty
  useEffect(() => {
    if (selectedReportPlotIds.length === 0 && filteredPlots.length > 0) {
      setSelectedReportPlotIds(filteredPlots.map((p) => p.id));
    }
  }, [filteredPlots]);

  // Active plots for report rendering based on chosen plot scope
  const activeReportPlots = useMemo(() => {
    if (reportPlotScope === 'all') return plots;
    if (reportPlotScope === 'selected') {
      const idSet = new Set(selectedReportPlotIds);
      const selected = plots.filter((p) => idSet.has(p.id));
      return selected.length > 0 ? selected : filteredPlots;
    }
    return filteredPlots;
  }, [plots, filteredPlots, reportPlotScope, selectedReportPlotIds]);

  // Total Portfolio Metrics for active report plots
  const metrics = useMemo(() => {
    let totalCost = 0;
    let totalPurchase = 0;
    let totalTargetSale = 0;
    let totalRealizedSales = 0;
    let totalRealizedCost = 0;
    let totalRealizedProfit = 0;
    let totalSqWah = 0;

    activeReportPlots.forEach((p) => {
      const cost = Number(p.totalCost) || 0;
      const purchase = Number(p.purchasePrice) || 0;
      const target = Number(p.targetSalePrice) || 0;
      const sold = Number(p.soldPrice) || 0;
      const net = Number(p.netReceived) || sold;
      const sqw = Number(p.totalSqWah) || 0;

      totalCost += cost;
      totalPurchase += purchase;
      totalSqWah += sqw;
      totalTargetSale += target;

      if (p.status === 'sold') {
        totalRealizedSales += sold;
        totalRealizedCost += cost;
        totalRealizedProfit += (net > 0 ? net : sold) - cost;
      }
    });

    const activePlots = activeReportPlots.filter((p) => p.status !== 'sold');
    const activePlotsCost = activePlots.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
    const activePlotsTarget = activePlots.reduce((sum, p) => sum + (Number(p.targetSalePrice) || 0), 0);

    const projectedUnrealizedProfit = activePlotsTarget > 0 ? activePlotsTarget - activePlotsCost : (totalTargetSale > 0 ? totalTargetSale - totalCost : 0);
    const overallROI = totalCost > 0 ? ((totalRealizedProfit + projectedUnrealizedProfit) / totalCost) * 100 : 0;

    return {
      totalCost,
      totalPurchase,
      totalTargetSale,
      totalRealizedSales,
      totalRealizedProfit,
      projectedUnrealizedProfit,
      totalExpectedGain: totalRealizedProfit + projectedUnrealizedProfit,
      overallROI,
      totalSqWah,
      totalRai: Number((totalSqWah / 400).toFixed(2)),
      count: activeReportPlots.length,
    };
  }, [activeReportPlots]);

  // P&L Grouped by Land Type
  const landTypeReport = useMemo(() => {
    const map = new Map<string, {
      type: string;
      plotsCount: number;
      holdingCount: number;
      soldCount: number;
      consignmentCount: number;
      totalSqWah: number;
      totalCost: number;
      purchasePrice: number;
      otherCosts: number;
      realizedSales: number;
      realizedProfit: number;
      targetSalePrice: number;
      projectedProfit: number;
    }>();

    activeReportPlots.forEach((p) => {
      const type = p.landType || 'อื่นๆ';
      if (!map.has(type)) {
        map.set(type, {
          type,
          plotsCount: 0,
          holdingCount: 0,
          soldCount: 0,
          consignmentCount: 0,
          totalSqWah: 0,
          totalCost: 0,
          purchasePrice: 0,
          otherCosts: 0,
          realizedSales: 0,
          realizedProfit: 0,
          targetSalePrice: 0,
          projectedProfit: 0,
        });
      }

      const item = map.get(type)!;
      item.plotsCount += 1;
      const cost = Number(p.totalCost) || 0;
      const purchase = Number(p.purchasePrice) || 0;
      const other = (Number(p.taxAndFees) || 0) + (Number(p.surveyCost) || 0) + (Number(p.otherExpenses) || 0);
      const sqw = Number(p.totalSqWah) || 0;
      const sold = Number(p.soldPrice) || 0;
      const net = Number(p.netReceived) || sold;
      const target = Number(p.targetSalePrice) || 0;

      item.totalCost += cost;
      item.purchasePrice += purchase;
      item.otherCosts += other;
      item.totalSqWah += sqw;
      item.targetSalePrice += target;

      if (p.status === 'sold') {
        item.soldCount += 1;
        item.realizedSales += sold;
        item.realizedProfit += (net > 0 ? net : sold) - cost;
      } else {
        if (p.status === 'consignment') item.consignmentCount += 1;
        else item.holdingCount += 1;

        item.projectedProfit += target > 0 ? (target - cost) : 0;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [activeReportPlots]);

  // P&L Grouped by Time Period (Yearly Timeline)
  const timelineReport = useMemo(() => {
    const map = new Map<string, {
      year: string;
      plotsCount: number;
      totalCost: number;
      purchasePrice: number;
      otherCosts: number;
      realizedSales: number;
      realizedProfit: number;
      targetSalePrice: number;
      projectedProfit: number;
      totalSqWah: number;
    }>();

    activeReportPlots.forEach((p) => {
      const year = extractYear(p.purchaseDate);
      if (!map.has(year)) {
        map.set(year, {
          year,
          plotsCount: 0,
          totalCost: 0,
          purchasePrice: 0,
          otherCosts: 0,
          realizedSales: 0,
          realizedProfit: 0,
          targetSalePrice: 0,
          projectedProfit: 0,
          totalSqWah: 0,
        });
      }

      const item = map.get(year)!;
      item.plotsCount += 1;
      const cost = Number(p.totalCost) || 0;
      const purchase = Number(p.purchasePrice) || 0;
      const other = (Number(p.taxAndFees) || 0) + (Number(p.surveyCost) || 0) + (Number(p.otherExpenses) || 0);
      const sqw = Number(p.totalSqWah) || 0;
      const sold = Number(p.soldPrice) || 0;
      const net = Number(p.netReceived) || sold;
      const target = Number(p.targetSalePrice) || 0;

      item.totalCost += cost;
      item.purchasePrice += purchase;
      item.otherCosts += other;
      item.totalSqWah += sqw;
      item.targetSalePrice += target;

      if (p.status === 'sold') {
        item.realizedSales += sold;
        item.realizedProfit += (net > 0 ? net : sold) - cost;
      } else {
        item.projectedProfit += target > 0 ? (target - cost) : 0;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year === 'ไม่ระบุปี') return 1;
      if (b.year === 'ไม่ระบุปี') return -1;
      return parseInt(a.year) - parseInt(b.year);
    });
  }, [activeReportPlots]);

  // Print Report Handler (Native browser dialog optimized for high-contrast paper)
  const handlePrint = () => {
    // Ensure paper print mode is enabled for maximum black-ink contrast
    const wasPaperMode = paperPrintMode;
    setPaperPrintMode(true);
    triggerPrint('portrait');
    if (!wasPaperMode) {
      setTimeout(() => setPaperPrintMode(false), 1200);
    }
  };

  // Download or Open Printable PDF Report using jsPDF + html2canvas
  const handleDownloadPdf = async (action: 'download' | 'open' = 'download') => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      // Force paper print mode so white background & black text are rendered
      const wasPaperMode = paperPrintMode;
      if (!paperPrintMode) {
        setPaperPrintMode(true);
      }

      // Allow React to re-render DOM with all portfolio summary sub-views visible
      await new Promise((resolve) => setTimeout(resolve, 250));

      const element = reportRef.current;
      if (!element) {
        throw new Error('ไม่พบข้อมูลเนื้อหารายงาน');
      }

      if (document.fonts) {
        await document.fonts.ready;
      }

      // Safe, high-contrast, pure white html2canvas execution
      const canvas = await html2canvas(element, {
        scale: 2.0,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff', // PURE WHITE! Eliminates dark toner bloat!
        windowWidth: 1100,
        ignoreElements: (el) => 
          el.classList?.contains('no-print') || 
          el.classList?.contains('print:hidden') || 
          el.classList?.contains('management-control') ||
          el.tagName === 'BUTTON' ||
          el.id === 'pdf-toast-container' ||
          el.getAttribute('role') === 'alert',
      });

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Slice the canvas page by page to avoid overlapping or chopped text lines across pages
      const pageHeightPx = Math.floor((canvas.width * contentHeight) / contentWidth);
      const rawPagesCount = Math.ceil(canvas.height / pageHeightPx);
      let totalPagesCount = Math.max(1, rawPagesCount);
      // Eliminate blank trailing page if residue is just padding/empty space (< 30px)
      if (totalPagesCount > 1) {
        const lastPageH = canvas.height - ((totalPagesCount - 1) * pageHeightPx);
        if (lastPageH < 30) {
          totalPagesCount -= 1;
        }
      }

      for (let p = 0; p < totalPagesCount; p++) {
        if (p > 0) pdf.addPage();
        const srcY = p * pageHeightPx;
        const srcH = Math.min(pageHeightPx, canvas.height - srcY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        }

        const sliceData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = (srcH * contentWidth) / canvas.width;
        pdf.addImage(sliceData, 'JPEG', margin, margin, contentWidth, sliceHeightMm);
      }

      // Add page numbering on each page in standard ASCII (prevents Thai square glyph bugs in jsPDF)
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(51, 65, 85); // Slate-700
        pdf.text(
          `Page ${i} of ${totalPages} • Land Portfolio Performance Report • ${new Date().toISOString().slice(0, 10)}`,
          pageWidth / 2,
          pageHeight - 4,
          { align: 'center' }
        );
      }

      const cleanYear = selectedYear === 'all' ? 'All_Years' : `Year_${selectedYear}`;
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Land_Portfolio_Performance_Report_${cleanYear}_${dateStr}.pdf`;

      if (action === 'download') {
        pdf.save(fileName);
        setPdfSuccessToast('ดาวน์โหลดเอกสารรายงานสรุปพอร์ตโฟลิโอ (PDF ขาวดำ-ประหยัดหมึก คมชัด) เรียบร้อยแล้ว!');
      } else {
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const opened = window.open(blobUrl, '_blank');
        if (!opened) {
          pdf.save(fileName);
          setPdfSuccessToast('เปิดในแท็บใหม่ไม่สำเร็จ จึงบันทึกไฟล์ PDF ให้เรียบร้อย');
        } else {
          setPdfSuccessToast('เปิดเอกสารรายงาน (PDF ขาวดำ-ประหยัดหมึก คมชัด) ในแท็บใหม่เรียบร้อยแล้ว!');
        }
      }

      if (!wasPaperMode) {
        setPaperPrintMode(false);
      }

      setTimeout(() => setPdfSuccessToast(null), 4000);
    } catch (err: any) {
      console.warn('html2canvas direct PDF generation encountered an issue, launching browser print-to-pdf fallback:', err);
      // Fallback: window.print()
      setTimeout(() => {
        window.print();
      }, 300);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // CSV Export for Report
  const handleExportReportCsv = () => {
    const headers = [
      'กลุ่มรายงาน',
      'รายการ/ประเภท',
      'จำนวนแปลง',
      'เนื้อที่ (ตร.ว.)',
      'ต้นทุนรวมซื้อ (บาท)',
      'ค่าใช้จ่ายอื่น/ภาษี (บาท)',
      'ต้นทุนรวมสุทธิ (บาท)',
      'ยอดขายจริง (บาท)',
      'กำไรที่รับรู้แล้ว (บาท)',
      'ราคาตั้งใจขาย (บาท)',
      'กำไรคาดหวัง (บาท)',
      'ผลตอบแทนรวม (%)',
    ];

    const lines: string[] = [];
    lines.push(`"รายงานสรุปผลกำไรขาดทุนและแนวโน้มการลงทุน - ${settings.portfolioTitle || 'คุณอภิวัชร์'}"`);
    lines.push(`"ช่วงเวลา: ${selectedYear === 'all' ? 'ทุกปี' : selectedYear} | ประเภท: ${selectedLandType === 'all' ? 'ทุกประเภท' : selectedLandType}"`);
    lines.push(headers.map((h) => `"${h}"`).join(','));

    // Section 1: By Land Type
    landTypeReport.forEach((r) => {
      const roi = r.totalCost > 0 ? (((r.realizedProfit + r.projectedProfit) / r.totalCost) * 100).toFixed(1) : '0';
      lines.push([
        '"แยกตามประเภทที่ดิน"',
        `"${r.type}"`,
        r.plotsCount,
        r.totalSqWah,
        r.purchasePrice,
        r.otherCosts,
        r.totalCost,
        r.realizedSales,
        r.realizedProfit,
        r.targetSalePrice,
        r.projectedProfit,
        `"${roi}%"`,
      ].join(','));
    });

    // Section 2: By Time Period
    timelineReport.forEach((r) => {
      const roi = r.totalCost > 0 ? (((r.realizedProfit + r.projectedProfit) / r.totalCost) * 100).toFixed(1) : '0';
      lines.push([
        '"แยกตามช่วงเวลา (ปี พ.ศ.)"',
        `"${r.year}"`,
        r.plotsCount,
        r.totalSqWah,
        r.purchasePrice,
        r.otherCosts,
        r.totalCost,
        r.realizedSales,
        r.realizedProfit,
        r.targetSalePrice,
        r.projectedProfit,
        `"${roi}%"`,
      ].join(','));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', url);
    dlAnchor.setAttribute('download', `land_profit_loss_report_${new Date().toISOString().slice(0, 10)}.csv`);
    dlAnchor.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-xl print:hidden">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <BarChart3 className="w-3.5 h-3.5" /> P&L & Investment Trend Analytics
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            รายงานสรุปผลกำไร-ขาดทุน และแนวโน้มการลงทุนย้อนหลัง
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            วิเคราะห์ผลการดำเนินงานเปรียบเทียบต้นทุน ยอดขาย กำไรที่รับรู้แล้ว และกำไรคาดหวัง จำแนกตามประเภทที่ดินและช่วงเวลา
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Print / PDF Options Modal Button (Primary Action) */}
          <button
            onClick={() => setIsPrintConfigModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:shadow-emerald-500/40 border border-emerald-400/40 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="ตั้งค่าขอบเขตแปลงที่ดินและเลือกหมวดหมู่รายงานที่ต้องการพิมพ์ หรือเปิดดูเป็น PDF"
          >
            <Sliders className="w-4 h-4 text-emerald-100" />
            <span>ตัวเลือกพิมพ์ / PDF (Custom Print)</span>
          </button>

          {/* Download Report PDF Button (Primary Action using jsPDF) */}
          <button
            onClick={() => handleDownloadPdf('download')}
            disabled={isGeneratingPdf}
            className={`px-3 py-2 rounded-xl text-xs font-medium shadow flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isGeneratingPdf 
                ? 'bg-slate-800 text-slate-400 cursor-wait' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="ดาวน์โหลดรายงานสรุปพอร์ตโฟลิโอเป็นไฟล์เอกสาร PDF ด้วย jsPDF บันทึกเก็บไว้ในเครื่องทันที"
            aria-label="Download Report PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>กำลังสร้าง PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-400" />
                <span>ดาวน์โหลด PDF</span>
              </>
            )}
          </button>

          {/* Quick Preview in New Tab */}
          <button
            onClick={() => handleDownloadPdf('open')}
            disabled={isGeneratingPdf}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="เปิดดูตัวอย่างเอกสารรายงาน PDF ในแท็บใหม่ทันที"
          >
            <Eye className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">เปิดดู</span> PDF
          </button>

          {/* Print Report Dialog */}
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-600 hover:border-emerald-500/60 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-slate-900/30 transition-all cursor-pointer"
            title="พิมพ์รายงาน (Print) สรุปผลกำไร-ขาดทุน และตารางวิเคราะห์ทั้งหมดผ่านหน้าต่างเบราว์เซอร์"
            aria-label="Print Report"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>พิมพ์รายงาน</span>
          </button>

          {/* Export Report CSV */}
          <button
            onClick={handleExportReportCsv}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="ส่งออกรายงานเป็นไฟล์ CSV สำหรับ Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">ส่งออก</span> CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar: Year & Land Type Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">ช่วงเวลา (ปี พ.ศ.):</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">ทุกช่วงเวลาย้อนหลัง (All Years)</option>
              {allYears.map((yr) => (
                <option key={yr} value={yr}>
                  ปี พ.ศ. {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Land Type Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Layers className="w-4 h-4 text-teal-400" />
            <span className="font-medium">ประเภทที่ดิน:</span>
            <select
              value={selectedLandType}
              onChange={(e) => setSelectedLandType(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">ทุกประเภทที่ดิน (All Types)</option>
              {allLandTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Year Pill Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              selectedYear === 'all'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ทั้งหมด
          </button>
          {allYears.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                selectedYear === yr
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              พ.ศ.{yr}
            </button>
          ))}
        </div>
      </div>

      {/* Print Appearance & Paper Optimization Selector Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:hidden">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">
            รูปแบบเอกสารสำหรับการพิมพ์ (Print & PDF Format):
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPaperPrintMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              paperPrintMode
                ? 'bg-white text-slate-950 shadow-md border-2 border-emerald-500 font-bold'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="ปรับเอกสารเป็นกระดาษขาว ตัวหนังสือดำเข้ม คอนทราสต์สูง ไม่กลืนกัน สำหรับสั่งพิมพ์ด้วยหมึกดำ หรือถ่ายเอกสาร"
          >
            {paperPrintMode && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
            <span>📄 ขาวดำ-ประหยัดหมึก (แนะนำสำหรับพิมพ์หมึกดำ)</span>
          </button>

          <button
            onClick={() => setPaperPrintMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              !paperPrintMode
                ? 'bg-emerald-600 text-white shadow-md border border-emerald-400 font-bold'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="แสดงผลตามธีมหน้าจอปกติ"
          >
            {!paperPrintMode && <Check className="w-3.5 h-3.5 text-white" />}
            <span>🎨 โหมดสี (Screen Theme)</span>
          </button>
        </div>
      </div>

      {/* Helpful Paper Mode Notification Banner */}
      {paperPrintMode && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>โหมดพิมพ์ขาวดำ-ประหยัดหมึกเปิดใช้งานอยู่:</strong> ปรับตัวอักษรเป็นสีดำเข้มคมชัด ตัวเลขเด่นชัดบนพื้นกระดาษขาว ไม่เปลืองหมึก ไม่กลืนกับพื้นหลัง เหมาะสำหรับการพิมพ์ด้วยเครื่องพิมพ์หมึกดำ (Laser/Inkjet ขาวดำ) หรือบันทึกเป็น PDF ที่อ่านง่าย
            </span>
          </div>
        </div>
      )}

      {/* Printable Performance Analysis Report Container (Captured by jsPDF / Native Browser Print) */}
      <div 
        ref={reportRef} 
        id="printable-performance-report" 
        className={`space-y-6 pt-1 transition-colors font-['Sarabun','Prompt',sans-serif] ${
          paperPrintMode 
            ? 'bg-white text-slate-900 p-6 rounded-2xl border-2 border-slate-300 shadow-md' 
            : 'text-slate-100'
        }`}
      >
        {/* Formal Executive PDF Header */}
        <div className={`p-5 rounded-2xl border shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          paperPrintMode
            ? 'bg-slate-50 border-2 border-slate-900 text-slate-900'
            : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-750'
        }`}>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                paperPrintMode
                  ? 'bg-white text-slate-950 border-slate-400'
                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              }`}>
                รายงานสรุปผลการดำเนินงานและแนวโน้มการลงทุนในพอร์ตที่ดิน
              </span>
              <span className={`text-[11px] font-mono ${paperPrintMode ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                {selectedYear === 'all' ? 'ทุกช่วงเวลา' : `ปี พ.ศ. ${selectedYear}`} • {selectedLandType === 'all' ? 'ทุกประเภทที่ดิน' : selectedLandType}
              </span>
            </div>
            <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
              {settings.portfolioTitle || 'พอร์ตโฟลิโอการลงทุนที่ดิน - อภิวัชร์'}
            </h2>
            <p className={`text-xs ${paperPrintMode ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
              เจ้าของพอร์ต: <span className={`font-bold ${paperPrintMode ? 'text-slate-950' : 'text-slate-200'}`}>{settings.ownerName || 'อภิวัชร์'}</span> • แปลงที่ดินในรายงาน: <span className={`font-mono font-bold ${paperPrintMode ? 'text-slate-950 underline' : 'text-emerald-400'}`}>{metrics.count} แปลง</span> ({metrics.totalRai} ไร่ / {metrics.totalSqWah.toLocaleString('th-TH')} ตร.ว.)
            </p>
          </div>

          <div className={`text-left md:text-right text-xs font-mono border-t md:border-t-0 pt-3 md:pt-0 space-y-0.5 ${
            paperPrintMode ? 'border-slate-300 text-slate-800' : 'border-slate-800 text-slate-400'
          }`}>
            <div className={paperPrintMode ? 'text-slate-600 text-[10px]' : 'text-slate-500 text-[10px]'}>วันที่ออกเอกสารทางการ</div>
            <div className={`font-semibold ${paperPrintMode ? 'text-slate-950' : 'text-slate-200'}`}>
              {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className={`text-[11px] font-bold ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`}>
              {paperPrintMode ? 'ฉบับพิมพ์ประหยัดหมึก / ขาวดำ คอนทราสต์สูง' : 'เอกสารทางการสำหรับการวิเคราะห์และบริหารการลงทุน'}
            </div>
          </div>
        </div>

        {/* Top 4 KPI Highlight Cards for Selected Report Period */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${!reportSections.executiveSummary ? 'print:hidden' : ''}`}>
          {/* Card 1: Total Cost */}
          <div className={`p-5 rounded-xl border ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-300 shadow-sm text-slate-900'
              : 'bg-slate-900/80 border-slate-800 text-slate-100'
          }`}>
            <div className={`flex items-center justify-between mb-2 ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              <span className="text-xs uppercase font-bold tracking-wide">เงินลงทุนรวมสุทธิ (Total Cost)</span>
              <Coins className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-blue-400'}`} />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
              {formatCurrency(metrics.totalCost)}
            </div>
            <div className={`text-xs mt-2 flex justify-between font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              <span>จำนวนแปลง: {metrics.count} แปลง</span>
              <span className={`font-mono font-bold ${paperPrintMode ? 'text-slate-950' : 'text-amber-400'}`}>{metrics.totalRai} ไร่</span>
            </div>
          </div>

          {/* Card 2: Realized Profit */}
          <div className={`p-5 rounded-xl border ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-300 shadow-sm text-slate-900'
              : 'bg-slate-900/80 border-slate-800 text-slate-100'
          }`}>
            <div className={`flex items-center justify-between mb-2 ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              <span className="text-xs uppercase font-bold tracking-wide">กำไรที่รับรู้แล้วจริง (Realized Gain)</span>
              <CheckCircle2 className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${paperPrintMode ? 'text-slate-950' : 'text-emerald-400'}`}>
              {metrics.totalRealizedProfit > 0 ? `+${formatCurrency(metrics.totalRealizedProfit)}` : formatCurrency(metrics.totalRealizedProfit)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                จากยอดขาย: {formatCurrency(metrics.totalRealizedSales)}
              </span>
              {paperPrintMode && metrics.totalRealizedProfit > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-400 text-slate-950">
                  รับรู้จริง
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Unrealized / Projected Profit */}
          <div className={`p-5 rounded-xl border ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-300 shadow-sm text-slate-900'
              : 'bg-slate-900/80 border-slate-800 text-slate-100'
          }`}>
            <div className={`flex items-center justify-between mb-2 ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              <span className="text-xs uppercase font-bold tracking-wide">กำไรคาดหวังตามเป้า (Projected Gain)</span>
              <TrendingUp className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-teal-400'}`} />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${paperPrintMode ? 'text-slate-950' : 'text-teal-300'}`}>
              +{formatCurrency(metrics.projectedUnrealizedProfit)}
            </div>
            <div className={`text-xs mt-2 font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              เป้าหมายราคาขายรวม: {formatCurrency(metrics.totalTargetSale)}
            </div>
          </div>

          {/* Card 4: Overall ROI */}
          <div className={`p-5 rounded-xl border ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-300 shadow-sm text-slate-900'
              : 'bg-slate-900/80 border-slate-800 text-slate-100'
          }`}>
            <div className={`flex items-center justify-between mb-2 ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              <span className="text-xs uppercase font-bold tracking-wide">ผลตอบแทนรวมคาดการณ์ (% ROI)</span>
              <ArrowUpRight className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${paperPrintMode ? 'text-slate-950' : 'text-emerald-300'}`}>
              +{metrics.overallROI.toFixed(1)}%
            </div>
            <div className={`text-xs mt-2 font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
              กำไรสุทธิรวม: +{formatCurrency(metrics.totalExpectedGain)}
            </div>
          </div>
        </div>

        {/* Report Section Tabs */}
        <div className={`flex border-b space-x-4 print:hidden no-print management-control ${paperPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
          <button
            onClick={() => setReportSubTab('forecast')}
            className={`py-2 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              reportSubTab === 'forecast'
                ? paperPrintMode ? 'border-slate-950 text-slate-950 font-bold' : 'border-emerald-500 text-emerald-400'
                : paperPrintMode ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📈 กราฟ D3 เป้ารายได้ vs ยอดขายจริง
          </button>
          <button
            onClick={() => setReportSubTab('landType')}
            className={`py-2 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              reportSubTab === 'landType'
                ? paperPrintMode ? 'border-slate-950 text-slate-950 font-bold' : 'border-emerald-500 text-emerald-400'
                : paperPrintMode ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 สรุปกำไรขาดทุนแยกตามประเภทที่ดิน (By Land Type)
          </button>
          <button
            onClick={() => setReportSubTab('timeline')}
            className={`py-2 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              reportSubTab === 'timeline'
                ? paperPrintMode ? 'border-slate-950 text-slate-950 font-bold' : 'border-emerald-500 text-emerald-400'
                : paperPrintMode ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 แนวโน้มการลงทุนและผลตอบแทนย้อนหลัง (Historical Trend)
          </button>
          <button
            onClick={() => setReportSubTab('performance')}
            className={`py-2 px-1 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              reportSubTab === 'performance'
                ? paperPrintMode ? 'border-slate-950 text-slate-950 font-bold' : 'border-emerald-500 text-emerald-400'
                : paperPrintMode ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🏆 ลำดับแปลงกำไรสูงสุด & ประสิทธิภาพพอร์ต (Performance)
          </button>
        </div>

        {/* Sub-view 0: D3 Revenue Forecast vs Realized Line Chart */}
        <div className={`space-y-6 ${reportSubTab === 'forecast' || (isGeneratingPdf && reportSections.d3Chart) ? 'block' : 'hidden print:block avoid-break'} ${!reportSections.d3Chart ? 'print:hidden' : ''}`}>
          <RevenueForecastVsRealizedChart
            plots={activeReportPlots}
            paperPrintMode={paperPrintMode}
            onSelectPlot={onSelectPlot}
          />
        </div>

        {/* Sub-view 1: Report Grouped By Land Type */}
        <div className={`space-y-6 ${reportSubTab === 'landType' || (isGeneratingPdf && reportSections.landType) ? 'block' : 'hidden print:block avoid-break'} ${!reportSections.landType ? 'print:hidden' : ''}`}>
          {/* Visual Profit Comparison Across Land Types */}
          <div className={`p-5 rounded-xl border space-y-4 shadow-sm ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-300 text-slate-900'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm flex items-center gap-2 ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                <Layers className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
                เปรียบเทียบสัดส่วนต้นทุนและกำไรคาดหวังตามประเภทที่ดิน
              </h3>
              <span className={`text-xs font-mono font-bold ${paperPrintMode ? 'text-slate-800' : 'text-slate-400'}`}>
                ต้นทุนรวม {formatCurrency(metrics.totalCost)}
              </span>
            </div>

            <div className="space-y-3">
              {landTypeReport.map((item) => {
                const costPercent = metrics.totalCost > 0 ? (item.totalCost / metrics.totalCost) * 100 : 0;
                const roi = item.totalCost > 0 ? (((item.realizedProfit + item.projectedProfit) / item.totalCost) * 100).toFixed(1) : '0';

                return (
                  <div 
                    key={item.type} 
                    className={`space-y-1.5 p-3.5 rounded-lg border ${
                      paperPrintMode
                        ? 'bg-slate-50 border-slate-300'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${paperPrintMode ? 'text-slate-950' : 'text-slate-100'}`}>
                          {item.type}
                        </span>
                        <span className={`text-xs font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                          ({item.plotsCount} แปลง • {formatThaiArea(0, 0, item.totalSqWah)})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className={`font-medium ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          ต้นทุน: <strong>{formatCurrency(item.totalCost)}</strong> ({costPercent.toFixed(1)}%)
                        </span>
                        <span className={`font-bold ${paperPrintMode ? 'text-slate-950' : 'text-emerald-400'}`}>
                          กำไรรวม: +{formatCurrency(item.realizedProfit + item.projectedProfit)} (ROI: +{roi}%)
                        </span>
                      </div>
                    </div>

                    {/* High-Contrast Progress Bar: light track with dark charcoal fill on paper */}
                    <div className={`w-full h-3 rounded-full overflow-hidden flex print-progress-track ${
                      paperPrintMode
                        ? 'bg-slate-200 border border-slate-300'
                        : 'bg-slate-800'
                    }`}>
                      <div
                        className={`h-full print-progress-bar ${
                          paperPrintMode
                            ? 'bg-slate-800'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${Math.max(costPercent, 2)}%` }}
                        title={`สัดส่วนเงินลงทุน: ${costPercent.toFixed(1)}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Land Type P&L Table */}
          <div className={`rounded-xl border overflow-hidden shadow-sm ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-400'
              : 'bg-slate-900 border-slate-800 shadow-xl'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              paperPrintMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-800/40 border-slate-800'
            }`}>
              <h3 className={`font-bold text-sm ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                ตารางสรุปผลกำไร-ขาดทุนแยกตามประเภทที่ดินอย่างละเอียด
              </h3>
              <span className={`text-xs font-semibold ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                รวม {landTypeReport.length} กลุ่มประเภทที่ดิน
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-bold ${
                    paperPrintMode
                      ? 'bg-slate-100 border-slate-400 text-slate-950'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300'
                  }`}>
                    <th className="py-3 px-3">ประเภทที่ดิน</th>
                    <th className="py-3 px-2 text-center">แปลง</th>
                    <th className="py-3 px-3 text-right">เนื้อที่รวม</th>
                    <th className="py-3 px-3 text-right">ราคาซื้อที่ดิน</th>
                    <th className="py-3 px-3 text-right">ค่าธรรมเนียม/รังวัด</th>
                    <th className={`py-3 px-3 text-right font-bold ${
                      paperPrintMode ? 'text-black bg-slate-200/80' : 'text-white bg-slate-800/60'
                    }`}>
                      ต้นทุนรวมสุทธิ
                    </th>
                    <th className={`py-3 px-3 text-right ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-400'}`}>ยอดขายจริง</th>
                    <th className={`py-3 px-3 text-right ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-300'}`}>กำไรที่รับรู้แล้ว</th>
                    <th className={`py-3 px-3 text-right ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-teal-300'}`}>กำไรคาดหวัง</th>
                    <th className={`py-3 px-3 text-right font-bold ${paperPrintMode ? 'text-black font-extrabold' : 'text-emerald-400'}`}>ROI รวม</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${paperPrintMode ? 'divide-slate-200 text-slate-900' : 'divide-slate-800/70'}`}>
                  {landTypeReport.map((row) => {
                    const totalGain = row.realizedProfit + row.projectedProfit;
                    const roi = row.totalCost > 0 ? ((totalGain / row.totalCost) * 100).toFixed(1) : '0';

                    return (
                      <tr 
                        key={row.type} 
                        className={`transition-colors ${
                          paperPrintMode
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className={`py-3 px-3 font-bold flex items-center gap-1.5 ${paperPrintMode ? 'text-slate-950' : 'text-slate-100'}`}>
                          <span className={`w-2 h-2 rounded-full ${paperPrintMode ? 'bg-slate-900' : 'bg-emerald-400'}`} />
                          {row.type}
                        </td>
                        <td className={`py-3 px-2 text-center font-mono ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          {row.plotsCount}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          {row.totalSqWah.toLocaleString('th-TH')} ตร.ว.
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          {formatCurrency(row.purchasePrice)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                          {formatCurrency(row.otherCosts)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${
                          paperPrintMode ? 'text-black bg-slate-100' : 'text-white bg-slate-800/30'
                        }`}>
                          {formatCurrency(row.totalCost)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-400'}`}>
                          {row.realizedSales > 0 ? formatCurrency(row.realizedSales) : '-'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-300'}`}>
                          {row.realizedProfit > 0 ? `+${formatCurrency(row.realizedProfit)}` : '-'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-semibold ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-teal-300'}`}>
                          +{formatCurrency(row.projectedProfit)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${paperPrintMode ? 'text-black font-extrabold' : 'text-emerald-400'}`}>
                          +{roi}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className={`font-bold border-t-2 ${
                  paperPrintMode
                    ? 'bg-slate-100 border-slate-500 text-slate-950'
                    : 'bg-slate-800/90 border-slate-700 text-slate-100'
                }`}>
                  <tr>
                    <td colSpan={2} className="py-3 px-3 uppercase text-xs">
                      ยอดรวมทั้งหมด:
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-amber-400'}`}>
                      {metrics.totalSqWah.toLocaleString('th-TH')} ตร.ว.
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {formatCurrency(metrics.totalPurchase)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                      {formatCurrency(metrics.totalCost - metrics.totalPurchase)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono text-sm ${
                      paperPrintMode ? 'text-black font-extrabold bg-slate-200/80' : 'text-white bg-slate-800'
                    }`}>
                      {formatCurrency(metrics.totalCost)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-400'}`}>
                      {formatCurrency(metrics.totalRealizedSales)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-300'}`}>
                      +{formatCurrency(metrics.totalRealizedProfit)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-teal-300'}`}>
                      +{formatCurrency(metrics.projectedUnrealizedProfit)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono text-sm ${paperPrintMode ? 'text-black font-extrabold' : 'text-emerald-400'}`}>
                      +{metrics.overallROI.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Sub-view 2: Report Grouped By Time Period (Historical Trend) */}
        <div className={`space-y-6 ${reportSubTab === 'timeline' || (isGeneratingPdf && reportSections.timeline) ? 'block' : 'hidden print:block avoid-break'} ${!reportSections.timeline ? 'print:hidden' : ''}`}>
          {/* Historical Investment Timeline Chart */}
          <div className={`p-5 rounded-xl border space-y-4 shadow-sm ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-300 text-slate-900'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-sm flex items-center gap-2 ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                  <TrendingUp className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
                  แนวโน้มการลงทุนและผลตอบแทนย้อนหลังตามปี (Historical Capital Timeline)
                </h3>
                <p className={`text-xs mt-0.5 ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                  แสดงปริมาณเงินทุนที่นำไปซื้อที่ดินในแต่ละปี พ.ศ. และผลตอบแทนคาดการณ์
                </p>
              </div>
              <span className={`text-xs font-mono font-bold ${paperPrintMode ? 'text-slate-800' : 'text-slate-400'}`}>
                ข้อมูลย้อนหลัง {timelineReport.length} ปี
              </span>
            </div>

            {/* Visual Timeline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {timelineReport.map((t) => {
                const percent = metrics.totalCost > 0 ? (t.totalCost / metrics.totalCost) * 100 : 0;
                const roi = t.totalCost > 0 ? (((t.realizedProfit + t.projectedProfit) / t.totalCost) * 100).toFixed(1) : '0';

                return (
                  <div
                    key={t.year}
                    className={`p-4 rounded-xl border space-y-2 transition-colors ${
                      paperPrintMode
                        ? 'bg-slate-50 border-slate-300'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-md font-mono font-bold text-sm border ${
                        paperPrintMode
                          ? 'bg-white text-slate-950 border-slate-400'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {t.year === 'ไม่ระบุปี' ? t.year : `พ.ศ. ${t.year}`}
                      </span>
                      <span className={`text-xs font-bold ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                        {t.plotsCount} แปลง
                      </span>
                    </div>

                    <div className="pt-2">
                      <span className={`text-[11px] block font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-500'}`}>
                        เงินลงทุนซื้อในปีนี้:
                      </span>
                      <span className={`text-base font-bold font-mono ${paperPrintMode ? 'text-black' : 'text-white'}`}>
                        {formatCurrency(t.totalCost)}
                      </span>
                      <div className={`text-[10px] mt-0.5 font-medium ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                        ({percent.toFixed(1)}% ของพอร์ต)
                      </div>
                    </div>

                    <div className={`pt-2 border-t flex justify-between items-center text-xs ${
                      paperPrintMode ? 'border-slate-300' : 'border-slate-800/80'
                    }`}>
                      <span className={paperPrintMode ? 'text-slate-700 font-medium' : 'text-slate-400'}>กำไรคาดหวัง:</span>
                      <span className={`font-mono font-bold ${paperPrintMode ? 'text-slate-950 font-extrabold' : 'text-emerald-400'}`}>
                        +{roi}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Period Summary Table */}
          <div className={`rounded-xl border overflow-hidden shadow-sm ${
            paperPrintMode
              ? 'bg-white border-2 border-slate-400'
              : 'bg-slate-900 border-slate-800 shadow-xl'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              paperPrintMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-800/40 border-slate-800'
            }`}>
              <h3 className={`font-bold text-sm ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                ตารางสรุปผลกำไร-ขาดทุนย้อนหลังแยกตามปี พ.ศ.
              </h3>
              <span className={`text-xs font-semibold ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                วิเคราะห์แนวโน้มการเติบโตและการถือครอง
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-bold ${
                    paperPrintMode
                      ? 'bg-slate-100 border-slate-400 text-slate-950'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300'
                  }`}>
                    <th className="py-3 px-3">ช่วงเวลา (ปี พ.ศ.)</th>
                    <th className="py-3 px-2 text-center">จำนวนแปลง</th>
                    <th className="py-3 px-3 text-right">เนื้อที่ดินรวม</th>
                    <th className="py-3 px-3 text-right">เงินซื้อที่ดิน</th>
                    <th className="py-3 px-3 text-right">ค่าธรรมเนียม/รังวัด</th>
                    <th className={`py-3 px-3 text-right font-bold ${
                      paperPrintMode ? 'text-black bg-slate-200/80' : 'text-white bg-slate-800/60'
                    }`}>
                      ต้นทุนรวมสุทธิ
                    </th>
                    <th className={`py-3 px-3 text-right ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-400'}`}>ยอดขายจริง</th>
                    <th className={`py-3 px-3 text-right ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-300'}`}>กำไรที่รับรู้แล้ว</th>
                    <th className={`py-3 px-3 text-right ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-teal-300'}`}>กำไรคาดหวัง</th>
                    <th className={`py-3 px-3 text-right font-bold ${paperPrintMode ? 'text-black font-extrabold' : 'text-emerald-400'}`}>ROI รวม</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${paperPrintMode ? 'divide-slate-200 text-slate-900' : 'divide-slate-800/70'}`}>
                  {timelineReport.map((t) => {
                    const totalGain = t.realizedProfit + t.projectedProfit;
                    const roi = t.totalCost > 0 ? ((totalGain / t.totalCost) * 100).toFixed(1) : '0';

                    return (
                      <tr 
                        key={t.year} 
                        className={`transition-colors ${
                          paperPrintMode
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className={`py-3 px-3 font-mono font-bold flex items-center gap-2 ${paperPrintMode ? 'text-slate-950' : 'text-slate-100'}`}>
                          <Calendar className={`w-3.5 h-3.5 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
                          {t.year === 'ไม่ระบุปี' ? t.year : `พ.ศ. ${t.year}`}
                        </td>
                        <td className={`py-3 px-2 text-center font-mono ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          {t.plotsCount}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          {t.totalSqWah.toLocaleString('th-TH')} ตร.ว.
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-800' : 'text-slate-300'}`}>
                          {formatCurrency(t.purchasePrice)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                          {formatCurrency(t.otherCosts)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${
                          paperPrintMode ? 'text-black bg-slate-100' : 'text-white bg-slate-800/30'
                        }`}>
                          {formatCurrency(t.totalCost)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-400'}`}>
                          {t.realizedSales > 0 ? formatCurrency(t.realizedSales) : '-'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-emerald-300'}`}>
                          {t.realizedProfit > 0 ? `+${formatCurrency(t.realizedProfit)}` : '-'}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-semibold ${paperPrintMode ? 'text-slate-950 font-bold' : 'text-teal-300'}`}>
                          +{formatCurrency(t.projectedProfit)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${paperPrintMode ? 'text-black font-extrabold' : 'text-emerald-400'}`}>
                          +{roi}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sub-view 3: Performance Ranking & Matrix */}
        <div className={`space-y-6 ${reportSubTab === 'performance' || (isGeneratingPdf && reportSections.performance) ? 'block' : 'hidden print:block avoid-break'} ${!reportSections.performance ? 'print:hidden' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Return on Investment (ROI %) Plots */}
            <div className={`p-5 rounded-xl border space-y-3 shadow-sm ${
              paperPrintMode
                ? 'bg-white border-2 border-slate-300 text-slate-900'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <h3 className={`font-bold text-sm flex items-center gap-2 ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                <ArrowUpRight className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
                แปลงที่มีอัตราผลตอบแทนคาดหวังสูงสุด (% ROI)
              </h3>
              <div className={`divide-y ${paperPrintMode ? 'divide-slate-200' : 'divide-slate-800/80'}`}>
                {[...activeReportPlots]
                  .sort((a, b) => {
                    const gainA = (a.targetSalePrice || 0) > 0 ? (a.targetSalePrice - a.totalCost) / (a.totalCost || 1) : 0;
                    const gainB = (b.targetSalePrice || 0) > 0 ? (b.targetSalePrice - b.totalCost) / (b.totalCost || 1) : 0;
                    return gainB - gainA;
                  })
                  .slice(0, 5)
                  .map((p) => {
                    const gain = (p.targetSalePrice || 0) > 0 ? p.targetSalePrice - p.totalCost : 0;
                    const roi = p.totalCost > 0 ? (gain / p.totalCost) * 100 : 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPlot(p)}
                        className={`py-3 flex items-center justify-between cursor-pointer px-2 rounded-lg transition-colors text-xs ${
                          paperPrintMode
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className={`font-bold ${paperPrintMode ? 'text-slate-950' : 'text-slate-100'}`}>
                            #{p.orderNumber} {p.title}
                          </div>
                          <div className={`text-[11px] ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                            {p.province} • ต้นทุน {formatCurrency(p.totalCost)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-sm ${paperPrintMode ? 'text-slate-950 font-extrabold' : 'text-emerald-400'}`}>
                            +{roi.toFixed(1)}%
                          </div>
                          <div className={`text-[10px] font-mono ${paperPrintMode ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                            +{formatCurrency(gain)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Largest Capital Outlay Plots */}
            <div className={`p-5 rounded-xl border space-y-3 shadow-sm ${
              paperPrintMode
                ? 'bg-white border-2 border-slate-300 text-slate-900'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <h3 className={`font-bold text-sm flex items-center gap-2 ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                <Coins className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-blue-400'}`} />
                แปลงที่ใช้เงินลงทุนสูงสุด (Capital Exposure)
              </h3>
              <div className={`divide-y ${paperPrintMode ? 'divide-slate-200' : 'divide-slate-800/80'}`}>
                {[...activeReportPlots]
                  .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
                  .slice(0, 5)
                  .map((p) => {
                    const share = metrics.totalCost > 0 ? (p.totalCost / metrics.totalCost) * 100 : 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPlot(p)}
                        className={`py-3 flex items-center justify-between cursor-pointer px-2 rounded-lg transition-colors text-xs ${
                          paperPrintMode
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className={`font-bold ${paperPrintMode ? 'text-slate-950' : 'text-slate-100'}`}>
                            #{p.orderNumber} {p.title}
                          </div>
                          <div className={`text-[11px] ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                            {p.province} • {formatThaiArea(p.rai, p.ngan, p.sqWah)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-sm ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
                            {formatCurrency(p.totalCost)}
                          </div>
                          <div className={`text-[10px] ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                            สัดส่วน {share.toFixed(1)}% ของพอร์ต
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Strategic Report Takeaways & Insights */}
        <div className={`p-5 rounded-xl border space-y-3 avoid-break ${!reportSections.insights ? 'print:hidden' : ''} ${
          paperPrintMode
            ? 'bg-slate-50 border-2 border-slate-300 text-slate-800'
            : 'bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-slate-800 text-slate-300'
        }`}>
          <h4 className={`font-bold text-xs sm:text-sm flex items-center gap-2 ${paperPrintMode ? 'text-slate-950' : 'text-white'}`}>
            <HelpCircle className={`w-4 h-4 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
            บทวิเคราะห์เชิงกลยุทธ์ของพอร์ตการลงทุน (Strategic Investment Insights):
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className={`p-3.5 rounded-lg border ${
              paperPrintMode ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}>
              <span className={`font-bold block mb-1 ${paperPrintMode ? 'text-slate-950' : 'text-emerald-400'}`}>
                1. สัดส่วนกำไรตามประเภท:
              </span>
              ที่ดินเปล่าและที่ดินเปล่าแบ่งโฉนดให้อัตรากำไรสุทธิคาดการณ์เฉลี่ยสูงกว่า 30-50% เนื่องจากมีต้นทุนคงที่ต่ำและสามารถตัดแบ่งขายเพื่อเพิ่มมูลค่าต่อตารางวาได้
            </div>
            <div className={`p-3.5 rounded-lg border ${
              paperPrintMode ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}>
              <span className={`font-bold block mb-1 ${paperPrintMode ? 'text-slate-950' : 'text-blue-400'}`}>
                2. ระยะเวลาการถือครอง (Holding Period):
              </span>
              แปลงที่ซื้อตั้งแต่ปี พ.ศ. 2555 (เช่น มัณฑนา วัชรพล 2) มีมูลค่าประเมินและราคาขายปรับตัวสูงขึ้นอย่างมีนัยสำคัญจากโครงข่ายคมนาคมและรถไฟฟ้าที่ขยายตัว
            </div>
            <div className={`p-3.5 rounded-lg border ${
              paperPrintMode ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}>
              <span className={`font-bold block mb-1 ${paperPrintMode ? 'text-slate-950' : 'text-amber-400'}`}>
                3. สภาพคล่องและการขายฝาก:
              </span>
              แปลงรับขายฝาก (เช่น นครสวรรค์ 14 ไร่) ให้ผลตอบแทนในรูปดอกเบี้ยคงที่ และมีหลักประกันเป็นที่ดินที่มีมูลค่าสูงกว่ายอดรับซื้อ
            </div>
          </div>
        </div>

        {/* Formal Executive Footer for Printable PDF */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 avoid-break ${
          paperPrintMode
            ? 'bg-slate-50 border border-slate-300 text-slate-800'
            : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${paperPrintMode ? 'text-slate-900' : 'text-emerald-400'}`} />
            <span className="font-medium">
              รายงานนี้ประมวลผลจากระบบฐานข้อมูลพอร์ตที่ดินจริง พร้อมข้อมูลการเงินและการประเมินผลตอบแทน
            </span>
          </div>
          <div className={`font-mono text-[11px] font-semibold ${paperPrintMode ? 'text-slate-800' : 'text-slate-500'}`}>
            ระบบจัดทำโดย: {settings.ownerName || 'คุณอภิวัชร์'} • รายงานวิเคราะห์ประสิทธิภาพการลงทุน
          </div>
        </div>
      </div>

      {/* PDF Success Toast Notification (Isolated outside report container so it is never captured by PDF canvas) */}
      {pdfSuccessToast && (
        <div 
          id="pdf-toast-container" 
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold shadow-2xl shadow-emerald-600/40 animate-fade-in border border-emerald-400/30 print:hidden no-print"
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{pdfSuccessToast}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* Print & PDF Configuration Modal (Selectable Sections & Plots)   */}
      {/* ============================================================== */}
      {isPrintConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in print:hidden">
          <div 
            className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    ตัวเลือกการพิมพ์และออกรายงาน PDF
                  </h3>
                  <p className="text-xs text-slate-400">
                    ปรับแต่งขอบเขตแปลงที่ดินและเลือกหมวดหมู่ที่ต้องการพิมพ์ได้อย่างอิสระ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintConfigModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-200">
              {/* Section 1: Plot Scope */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">1</span>
                    ขอบเขตแปลงที่ดินในรายงาน:
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    กำลังเลือก: {activeReportPlots.length} แปลง
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label 
                    onClick={() => setReportPlotScope('filtered')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      reportPlotScope === 'filtered'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">ตามตัวกรองปัจจุบัน</span>
                      <input 
                        type="radio" 
                        name="plotScope" 
                        checked={reportPlotScope === 'filtered'} 
                        onChange={() => setReportPlotScope('filtered')}
                        className="text-emerald-500 focus:ring-0" 
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      {filteredPlots.length} แปลง (ปี/ประเภทที่เลือก)
                    </span>
                  </label>

                  <label 
                    onClick={() => setReportPlotScope('all')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      reportPlotScope === 'all'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">แปลงทั้งหมดในพอร์ต</span>
                      <input 
                        type="radio" 
                        name="plotScope" 
                        checked={reportPlotScope === 'all'} 
                        onChange={() => setReportPlotScope('all')}
                        className="text-emerald-500 focus:ring-0" 
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      ครบทั้ง {plots.length} แปลง
                    </span>
                  </label>

                  <label 
                    onClick={() => setReportPlotScope('selected')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      reportPlotScope === 'selected'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">เลือกแปลงเฉพาะเจาะจง</span>
                      <input 
                        type="radio" 
                        name="plotScope" 
                        checked={reportPlotScope === 'selected'} 
                        onChange={() => setReportPlotScope('selected')}
                        className="text-emerald-500 focus:ring-0" 
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      {selectedReportPlotIds.length} แปลงที่เลือก
                    </span>
                  </label>
                </div>

                {/* Checklist when custom selection is active */}
                {reportPlotScope === 'selected' && (
                  <div className="mt-2 p-3 rounded-xl border border-slate-700 bg-slate-950/80 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[11px]">
                      <span className="text-slate-400 font-medium">
                        คลิกติ๊กถูกเพื่อเลือกแปลงที่ต้องการให้อยู่ในรายงาน:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReportPlotIds(plots.map((p) => p.id))}
                          className="text-emerald-400 hover:underline cursor-pointer font-semibold"
                        >
                          เลือกทั้งหมด ({plots.length})
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedReportPlotIds([])}
                          className="text-slate-400 hover:text-rose-400 hover:underline cursor-pointer"
                        >
                          ล้างการเลือก
                        </button>
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/80 pr-1">
                      {plots.map((p) => {
                        const isChecked = selectedReportPlotIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center justify-between py-2 px-1.5 rounded cursor-pointer transition-colors ${
                              isChecked ? 'bg-slate-800/40' : 'hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedReportPlotIds([...selectedReportPlotIds, p.id]);
                                  } else {
                                    setSelectedReportPlotIds(selectedReportPlotIds.filter((id) => id !== p.id));
                                  }
                                }}
                                className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <span className="font-bold text-slate-100">
                                  #{p.orderNumber} {p.title}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-2">
                                  {p.province} • {p.landType || 'ที่ดิน'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right font-mono text-[11px]">
                              <span className="text-slate-300">{formatCurrency(p.totalCost)}</span>
                              <span className={`ml-2 text-[10px] px-1.5 py-0.2 rounded ${
                                p.status === 'sold' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {p.status === 'sold' ? 'ขายแล้ว' : 'ถือครอง'}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Report Sections Selection */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">2</span>
                    เลือกหมวดหมู่ที่ต้องการให้อยู่ในเอกสาร (Report Sections):
                  </span>
                  
                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReportSections({
                        executiveSummary: true,
                        d3Chart: true,
                        landType: true,
                        timeline: true,
                        performance: true,
                        insights: true,
                      })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 cursor-pointer"
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportSections({
                        executiveSummary: true,
                        d3Chart: true,
                        landType: false,
                        timeline: false,
                        performance: false,
                        insights: true,
                      })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-400 cursor-pointer"
                    >
                      เฉพาะสรุปผู้บริหาร & กราฟ
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportSections({
                        executiveSummary: false,
                        d3Chart: false,
                        landType: true,
                        timeline: true,
                        performance: true,
                        insights: false,
                      })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-400 cursor-pointer"
                    >
                      เฉพาะตารางตัวเลข
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    reportSections.executiveSummary ? 'bg-slate-800/80 border-emerald-500/60' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={reportSections.executiveSummary}
                      onChange={(e) => setReportSections({ ...reportSections, executiveSummary: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-100">1. สรุปภาพรวมผู้บริหาร & บัตรตัวชี้วัด 4 มิติ</div>
                      <div className="text-[11px] text-slate-400">เงินลงทุนรวม, กำไรจริง, กำไรคาดหวัง และ % ROI</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    reportSections.d3Chart ? 'bg-slate-800/80 border-emerald-500/60' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={reportSections.d3Chart}
                      onChange={(e) => setReportSections({ ...reportSections, d3Chart: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>2. กราฟ D3 เป้ารายได้ vs ยอดขายจริง</span>
                        <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">D3 Live</span>
                      </div>
                      <div className="text-[11px] text-slate-400">เส้นเป้ารายได้สะสมเทียบยอดขายจริงที่รับรู้แล้ว</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    reportSections.landType ? 'bg-slate-800/80 border-emerald-500/60' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={reportSections.landType}
                      onChange={(e) => setReportSections({ ...reportSections, landType: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-100">3. สรุปผลกำไรตามประเภทที่ดิน & ตาราง</div>
                      <div className="text-[11px] text-slate-400">การกระจายตัวของเงินทุนและกำไรตามประเภท</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    reportSections.timeline ? 'bg-slate-800/80 border-emerald-500/60' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={reportSections.timeline}
                      onChange={(e) => setReportSections({ ...reportSections, timeline: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-100">4. แนวโน้มการลงทุนย้อนหลังตามปี พ.ศ.</div>
                      <div className="text-[11px] text-slate-400">ตารางและไทม์ไลน์เปรียบเทียบผลตอบแทนรายปี</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    reportSections.performance ? 'bg-slate-800/80 border-emerald-500/60' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={reportSections.performance}
                      onChange={(e) => setReportSections({ ...reportSections, performance: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-100">5. ลำดับแปลงกำไรสูงสุด & แปลงเงินลงทุนสูงสุด</div>
                      <div className="text-[11px] text-slate-400">Top Return on Investment (ROI) & Capital Exposure</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    reportSections.insights ? 'bg-slate-800/80 border-emerald-500/60' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={reportSections.insights}
                      onChange={(e) => setReportSections({ ...reportSections, insights: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-100">6. บทวิเคราะห์เชิงกลยุทธ์ & ช่องลงนาม</div>
                      <div className="text-[11px] text-slate-400">Strategic Insights และการรับรองรายงาน</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 3: Print Format / Paper Mode */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">3</span>
                  รูปแบบการแสดงผลของรายงาน (Print Style):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label 
                    onClick={() => setPaperPrintMode(true)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between ${
                      paperPrintMode ? 'bg-white text-slate-950 border-2 border-emerald-500 font-bold' : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs">📄 ขาวดำ-ประหยัดหมึก (Monochrome)</span>
                      <p className={`text-[10px] mt-0.5 ${paperPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>
                        ตัวหนังสือดำ คมชัด ประหยัดหมึกพิมพ์
                      </p>
                    </div>
                    <input 
                      type="radio" 
                      name="modalPaperMode" 
                      checked={paperPrintMode} 
                      onChange={() => setPaperPrintMode(true)} 
                      className="text-emerald-600 focus:ring-0" 
                    />
                  </label>

                  <label 
                    onClick={() => setPaperPrintMode(false)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between ${
                      !paperPrintMode ? 'bg-emerald-950/40 border-2 border-emerald-500 text-emerald-200 font-bold' : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs">🎨 โหมดสีหน้าจอ (Color Digital)</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        สีสันกราฟและชาร์ตตามธีมหน้าจอ
                      </p>
                    </div>
                    <input 
                      type="radio" 
                      name="modalPaperMode" 
                      checked={!paperPrintMode} 
                      onChange={() => setPaperPrintMode(false)} 
                      className="text-emerald-600 focus:ring-0" 
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer with Direct Actions */}
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>พร้อมพิมพ์สำหรับ: <strong>{activeReportPlots.length} แปลง</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsPrintConfigModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                >
                  ปิด
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPrintConfigModalOpen(false);
                    handleDownloadPdf('open');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="เปิดดู PDF ตัวอย่างในแท็บใหม่ทันที"
                >
                  <Eye className="w-4 h-4 text-teal-400" />
                  <span>เปิดดู PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPrintConfigModalOpen(false);
                    handleDownloadPdf('download');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="ดาวน์โหลดเป็นไฟล์ PDF"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>ดาวน์โหลด PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPrintConfigModalOpen(false);
                    handlePrint();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 border border-emerald-400/40 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title="สั่งพิมพ์รายงานผ่านหน้าต่างการพิมพ์ของเบราว์เซอร์"
                >
                  <Printer className="w-4 h-4 text-white" />
                  <span>พิมพ์รายงาน (Print)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
