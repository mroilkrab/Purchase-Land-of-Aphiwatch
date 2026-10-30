import React, { useState, useMemo, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  TrendingUp, 
  Wallet, 
  MapPin, 
  PieChart, 
  CheckCircle2, 
  Clock, 
  Landmark, 
  Layers, 
  ArrowUpRight, 
  ShieldCheck, 
  BadgePercent,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Calculator,
  Timer,
  Printer,
  Download,
  Eye,
  Loader2,
  Check,
  X,
  Sliders
} from 'lucide-react';
import { LandPlot, KPIStats, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea, calculatePlotHoldingInfo, HoldingPeriodInfo } from '../services/storage';
import { triggerPrint } from '../utils/print';

interface KPIDashboardProps {
  plots: LandPlot[];
  kpis: KPIStats;
  settings: PortfolioSettings;
  onNavigateToSimulator: () => void;
  onNavigateToTable: () => void;
  onNavigateToMap?: () => void;
  onNavigateToReports?: () => void;
  onSelectPlot: (plot: LandPlot) => void;
  onFilterTable?: (query: string) => void;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  plots,
  kpis,
  settings,
  onNavigateToSimulator,
  onNavigateToTable,
  onNavigateToMap,
  onNavigateToReports,
  onSelectPlot,
  onFilterTable,
}) => {
  // Holding Period Alert Configuration & State (Synced with settings)
  const [alertThresholdMonths, setAlertThresholdMonths] = useState<number>(() => settings.expectedHoldingPeriodMonths || 12);
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (settings.expectedHoldingPeriodMonths) {
      setAlertThresholdMonths(settings.expectedHoldingPeriodMonths);
    }
  }, [settings.expectedHoldingPeriodMonths]);

  // Compute holding period for all plots
  const plotsWithHoldingInfo = useMemo(() => {
    return plots.map((p) => ({
      plot: p,
      holding: calculatePlotHoldingInfo(p.purchaseDate),
    }));
  }, [plots]);

  // Plots that have exceeded target holding period without being sold
  const overduePlots = useMemo(() => {
    return plotsWithHoldingInfo
      .filter((item) => {
        // Only unsold / active plots
        if (item.plot.status === 'sold') return false;
        if (!item.holding.isValid) return false;
        return item.holding.monthsHeld >= alertThresholdMonths;
      })
      .sort((a, b) => b.holding.monthsHeld - a.holding.monthsHeld);
  }, [plotsWithHoldingInfo, alertThresholdMonths]);

  // Total capital tied up in overdue plots
  const overdueCapitalTiedUp = useMemo(() => {
    return overduePlots.reduce((sum, item) => sum + (Number(item.plot.totalCost) || 0), 0);
  }, [overduePlots]);

  // Total target value of overdue plots
  const overdueTargetValue = useMemo(() => {
    return overduePlots.reduce((sum, item) => sum + (Number(item.plot.targetSalePrice) || 0), 0);
  }, [overduePlots]);

  // Print & PDF Export State
  const printReportRef = useRef<HTMLDivElement>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'all' | 'selected' | 'overdue'>('all');
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // Filtered plots to print for Dashboard
  const dashboardPrintPlots = useMemo(() => {
    if (printScope === 'overdue') {
      return overduePlots.map((item) => item.plot);
    }
    if (printScope === 'selected') {
      const selected = plots.filter((p) => selectedPlotIds.includes(p.id));
      return selected.length > 0 ? selected : plots;
    }
    return plots;
  }, [printScope, plots, overduePlots, selectedPlotIds]);

  // Dynamic Dashboard Print Totals
  const dashboardPrintTotals = useMemo(() => {
    let totalCost = 0;
    let totalPurchase = 0;
    let totalTarget = 0;
    let totalSqWah = 0;
    let soldCount = 0;
    let holdingCount = 0;
    let forSaleCount = 0;

    dashboardPrintPlots.forEach((p) => {
      totalCost += Number(p.totalCost) || 0;
      totalPurchase += Number(p.purchasePrice) || 0;
      totalTarget += Number(p.targetSalePrice) || 0;
      totalSqWah += Number(p.totalSqWah) || 0;
      if (p.status === 'sold') soldCount++;
      else if (p.status === 'for_sale') forSaleCount++;
      else holdingCount++;
    });

    const expectedGain = totalTarget > totalCost ? totalTarget - totalCost : 0;
    const roi = totalCost > 0 ? (expectedGain / totalCost) * 100 : 0;

    return {
      count: dashboardPrintPlots.length,
      totalCost,
      totalPurchase,
      totalTarget,
      totalSqWah,
      totalRai: (totalSqWah / 400).toFixed(2),
      soldCount,
      holdingCount,
      forSaleCount,
      expectedGain,
      roi,
    };
  }, [dashboardPrintPlots]);

  const handlePrint = () => {
    setIsPrintModalOpen(false);
    triggerPrint(printOrientation);
  };

  const handlePrintSection = (scope: 'all' | 'selected' | 'overdue' = 'all') => {
    setPrintScope(scope);
    triggerPrint(printOrientation);
  };

  const handleExportPdf = async (action: 'download' | 'open') => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const element = printReportRef.current;
      if (!element) throw new Error('ไม่พบเทมเพลตรายงาน Dashboard');

      if (document.fonts) await document.fonts.ready;

      const isLandscape = printOrientation === 'landscape';
      const hadHidden = element.classList.contains('hidden');
      if (hadHidden) element.classList.remove('hidden');

      const prevDisplay = element.style.display;
      const prevPosition = element.style.position;
      const prevLeft = element.style.left;
      const prevTop = element.style.top;
      const prevWidth = element.style.width;
      const prevZ = element.style.zIndex;

      element.style.display = 'block';
      element.style.position = 'fixed';
      element.style.left = '-9999px';
      element.style.top = '0';
      element.style.width = isLandscape ? '1280px' : '980px';
      element.style.zIndex = '-1000';

      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(element, {
        scale: 2.0,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: isLandscape ? 1280 : 980,
        ignoreElements: (el) =>
          el.classList?.contains('no-print') ||
          el.classList?.contains('print:hidden') ||
          el.tagName === 'BUTTON',
      });

      element.style.display = prevDisplay;
      element.style.position = prevPosition;
      element.style.left = prevLeft;
      element.style.top = prevTop;
      element.style.width = prevWidth;
      element.style.zIndex = prevZ;
      if (hadHidden) element.classList.add('hidden');

      const pdf = new jsPDF({
        orientation: isLandscape ? 'l' : 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      const pageHeightPx = Math.floor((canvas.width * contentHeight) / contentWidth);
      const totalPagesCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

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

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(
          `หน้า ${i} จาก ${totalPages} • แดชบอร์ดวิเคราะห์ KPI พอร์ตที่ดิน • ${new Date().toLocaleDateString('th-TH')}`,
          pageWidth / 2,
          pageHeight - 4,
          { align: 'center' }
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Land_KPI_Dashboard_${printScope}_${dateStr}.pdf`;

      if (action === 'download') {
        pdf.save(fileName);
        setPdfToast('ดาวน์โหลดเอกสารรายงานแดชบอร์ด (PDF) เรียบร้อยแล้ว!');
      } else {
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const opened = window.open(blobUrl, '_blank');
        if (!opened) {
          pdf.save(fileName);
          setPdfToast('เบราว์เซอร์บล็อกป็อปอัป จึงบันทึกไฟล์ PDF ให้เรียบร้อยแล้ว');
        } else {
          setPdfToast('เปิดดูเอกสารแดชบอร์ด (PDF) ในแท็บใหม่เรียบร้อยแล้ว!');
        }
      }

      setIsPrintModalOpen(false);
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err: any) {
      console.warn('Dashboard PDF generation error:', err);
      setIsPrintModalOpen(false);
      setTimeout(() => {
        triggerPrint(printOrientation);
      }, 200);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // All active (unsold) plots count
  const totalActivePlots = useMemo(() => {
    return plots.filter((p) => p.status !== 'sold').length;
  }, [plots]);

  // Province distribution calculation
  const provinceStats = plots.reduce((acc, p) => {
    const prov = p.province?.trim() || 'ไม่ระบุ';
    if (!acc[prov]) {
      acc[prov] = { count: 0, cost: 0, sqWah: 0 };
    }
    acc[prov].count += 1;
    acc[prov].cost += Number(p.totalCost) || 0;
    acc[prov].sqWah += Number(p.totalSqWah) || 0;
    return acc;
  }, {} as Record<string, { count: number; cost: number; sqWah: number }>);

  // Land type distribution calculation
  const typeStats = plots.reduce((acc, p) => {
    const type = p.landType?.trim() || 'อื่นๆ';
    if (!acc[type]) {
      acc[type] = { count: 0, cost: 0 };
    }
    acc[type].count += 1;
    acc[type].cost += Number(p.totalCost) || 0;
    return acc;
  }, {} as Record<string, { count: number; cost: number }>);

  // Cost component breakdown
  const costBreakdown = plots.reduce(
    (acc, p) => {
      acc.purchase += Number(p.purchasePrice) || 0;
      acc.taxAndFees += Number(p.taxAndFees) || 0;
      acc.survey += Number(p.surveyCost) || 0;
      acc.other += Number(p.otherExpenses) || 0;
      return acc;
    },
    { purchase: 0, taxAndFees: 0, survey: 0, other: 0 }
  );

  const topPlotsByCost = [...plots].sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> ภาพรวมพอร์ตการลงทุนอสังหาริมทรัพย์
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            พอร์ตที่ดิน: {settings.ownerName || 'คุณอภิวัชร์'}
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            สรุปสถานะการซื้อ-ขายที่ดิน วิเคราะห์ต้นทุนจริง และผลตอบแทนคาดหวัง (KPI Projection) จากข้อมูลทั้งหมด {plots.length} รายการ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {onNavigateToMap && (
            <button
              onClick={onNavigateToMap}
              className="px-4 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              แผนที่พิกัดที่ดิน
            </button>
          )}
          {onNavigateToReports && (
            <button
              onClick={onNavigateToReports}
              className="px-4 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-blue-400" />
              รายงานกำไรขาดทุน (Reports)
            </button>
          )}
          <button
            onClick={onNavigateToSimulator}
            className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <BadgePercent className="w-4 h-4" />
            คำนวณกำไร KPI
          </button>
          <button
            onClick={onNavigateToTable}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            ดูตารางทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => handlePrintSection('all')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            title="พิมพ์รายงานสรุปแดชบอร์ดภาพรวมพอร์ต (A4 PDF / Print)"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>พิมพ์รายงาน</span>
          </button>
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="พิมพ์หรือส่งออกแดชบอร์ดเป็น PDF (A4 แนวนอน / แนวตั้ง)"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>ตัวเลือกพิมพ์ / PDF</span>
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Acquisition Cost */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">ต้นทุนรวมทั้งสิ้น (Acquisition Cost)</span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(kpis.totalAcquisitionCost)}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
            <span>ราคาซื้อที่ดิน: {formatCurrency(kpis.totalPurchaseCost)}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            (รวมค่าธรรมเนียม, รังวัด และค่าใช้จ่ายอื่น)
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        </div>

        {/* Card 2: Projected Sale Price & Expected Profit */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">ราคาที่ตั้งใจจะขาย (KPI Target)</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatCurrency(kpis.totalTargetSalePrice)}
          </div>
          <div className="text-xs text-emerald-300/90 mt-2 flex items-center gap-1 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" />
            กำไรคาดหวัง: +{formatCurrency(kpis.projectedGrossProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            คาดการณ์ผลตอบแทน (ROI): <span className="text-emerald-400 font-semibold">{kpis.projectedROI.toFixed(1)}%</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
        </div>

        {/* Card 3: Total Land Area */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">เนื้อที่ดินรวมทั้งหมด</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {kpis.totalAreaRai.toLocaleString('th-TH')} ไร่
          </div>
          <div className="text-xs text-slate-400 mt-2">
            รวม {kpis.totalAreaSqWah.toLocaleString('th-TH')} ตารางวา
          </div>
          <div className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1 font-medium">
            ถือครองอยู่: {kpis.holdingAreaRai.toLocaleString('th-TH')} ไร่ ({kpis.holdingAreaSqWah.toLocaleString('th-TH')} ตร.ว.)
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        </div>

        {/* Card 4: Status & Realized Cashflow */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">สถานะแปลงที่ดิน & ยอดขายจริง</span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{kpis.holdingPlots}</span>
            <span className="text-xs text-slate-400">ถือครอง</span>
            <span className="text-slate-600">|</span>
            <span className="text-xl font-bold text-emerald-400">{kpis.soldPlots}</span>
            <span className="text-xs text-slate-400">ขายแล้ว</span>
            {kpis.consignmentPlots > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-xl font-bold text-amber-400">{kpis.consignmentPlots}</span>
                <span className="text-xs text-slate-400">ขายฝาก</span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-300 mt-2">
            ยอดขายที่รับรู้แล้ว: {formatCurrency(kpis.totalRealizedSales)}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            สุทธิที่ได้รับจริง: {formatCurrency(kpis.totalNetReceived)}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
        </div>
      </div>

      {/* Analytics Charts & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Province Breakdown */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              การกระจายตัวตามจังหวัด ({Object.keys(provinceStats).length} จังหวัด)
            </h3>
            <button
              type="button"
              onClick={() => handlePrintSection('all')}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="พิมพ์รายงานการกระจายตัวตามจังหวัด (A4 PDF / Print)"
            >
              <Printer className="w-3 h-3 text-emerald-400" />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(provinceStats).map(([prov, stat]) => {
              const percent = kpis.totalAcquisitionCost > 0 ? (stat.cost / kpis.totalAcquisitionCost) * 100 : 0;
              return (
                <div key={prov} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      {prov} ({stat.count} แปลง)
                    </span>
                    <span className="text-slate-400 font-mono">
                      {formatCurrency(stat.cost)} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 text-right">
                    เนื้อที่รวม: {(stat.sqWah / 400).toFixed(2)} ไร่ ({stat.sqWah.toLocaleString('th-TH')} ตร.ว.)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Land Type Breakdown */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-teal-400" />
              สัดส่วนประเภทกรรมสิทธิ์ที่ดิน
            </h3>
            <button
              type="button"
              onClick={() => handlePrintSection('all')}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="พิมพ์รายงานประเภทกรรมสิทธิ์ที่ดิน (A4 PDF / Print)"
            >
              <Printer className="w-3 h-3 text-teal-400" />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(typeStats).map(([type, stat]) => {
              const percent = plots.length > 0 ? (stat.count / plots.length) * 100 : 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-200">{type}</span>
                    <span className="text-slate-400">
                      {stat.count} แปลง ({formatCurrency(stat.cost)})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${Math.max(percent, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost Structure Breakdown */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Landmark className="w-4 h-4 text-amber-400" />
              โครงสร้างต้นทุนและค่าใช้จ่ายรวม
            </h3>
            <button
              type="button"
              onClick={() => handlePrintSection('all')}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="พิมพ์รายงานโครงสร้างต้นทุน (A4 PDF / Print)"
            >
              <Printer className="w-3 h-3 text-amber-400" />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: 'ราคาซื้อที่ดิน (Purchase Price)', amount: costBreakdown.purchase, color: 'from-blue-500 to-indigo-500' },
              { label: 'ค่าธรรมเนียม/ภาษี/อากร', amount: costBreakdown.taxAndFees, color: 'from-amber-500 to-orange-500' },
              { label: 'ค่ารังวัดที่ดิน', amount: costBreakdown.survey, color: 'from-emerald-500 to-teal-500' },
              { label: 'ค่าใช้จ่ายอื่นๆ', amount: costBreakdown.other, color: 'from-purple-500 to-pink-500' },
            ].map((item) => {
              const percent = kpis.totalAcquisitionCost > 0 ? (item.amount / kpis.totalAcquisitionCost) * 100 : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-slate-400 font-mono">
                      {formatCurrency(item.amount)} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                      style={{ width: `${Math.max(percent, item.amount > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top 5 Capital Investment Plots Table */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white text-sm">
              อันดับแปลงที่ดินมูลค่าการลงทุนสูงสุด (Top 5 Investments)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              คลิกที่แปลงเพื่อดูรายละเอียด รูปภาพ แผนที่ และคำนวณราคาขาย
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrintSection('all')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="พิมพ์รายงานอันดับแปลงที่ดินมูลค่าการลงทุนสูงสุด (A4 PDF / Print)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>พิมพ์รายงาน</span>
            </button>
            <button
              onClick={onNavigateToTable}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              ดูทั้งหมด ({plots.length} รายการ) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 pb-2">
                <th className="py-2.5 px-3 font-medium">ลำดับ</th>
                <th className="py-2.5 px-3 font-medium">ชื่อแปลงที่ดิน</th>
                <th className="py-2.5 px-3 font-medium">ทำเล</th>
                <th className="py-2.5 px-3 font-medium">เนื้อที่</th>
                <th className="py-2.5 px-3 font-medium text-right">ต้นทุนรวม</th>
                <th className="py-2.5 px-3 font-medium text-right">ราคาตั้งใจขาย (KPI)</th>
                <th className="py-2.5 px-3 font-medium text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {topPlotsByCost.map((plot) => (
                <tr
                  key={plot.id}
                  onClick={() => onSelectPlot(plot)}
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-slate-400">{plot.orderNumber}</td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-200">{plot.title}</div>
                    <div className="text-[11px] text-slate-500">
                      เลขที่ดิน: {plot.primaryDeedNumber || '-'} ({plot.landType})
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {plot.subdistrict}, {plot.district}, {plot.province}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-mono">
                    {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                    <span className="text-[10px] text-slate-500 block">
                      ({plot.totalSqWah} ตร.ว.)
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-100 font-mono">
                    {formatCurrency(plot.totalCost)}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-emerald-400 font-mono">
                    {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        plot.status === 'sold'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : plot.status === 'consignment'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : plot.status === 'for_sale'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {plot.status === 'sold'
                        ? 'ขายแล้ว'
                        : plot.status === 'consignment'
                        ? 'ขายฝาก'
                        : plot.status === 'for_sale'
                        ? 'กำลังขาย'
                        : 'ถือครอง'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HOLDING PERIOD ALERT SYSTEM: Placed at the very bottom of KPIDashboard   */}
      {/* ========================================================================= */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xl ${
        overduePlots.length > 0 
          ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-rose-950/20 border-amber-500/30 ring-1 ring-amber-500/20' 
          : 'bg-slate-900/90 border-slate-800'
      }`}>
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
              overduePlots.length > 0 
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-amber-950/50 animate-pulse' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {overduePlots.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  ระบบแจ้งเตือนการถือครองที่ดิน (Holding Period &amp; Capital Alert)
                </h2>
                {overduePlots.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Timer className="w-3 h-3" /> เกินกำหนด {overduePlots.length} แปลง
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> สถานะปกติ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ติดตามแปลงที่ดินที่ยังไม่ได้ขาย (Unsold) และถือครองมานานกว่าเป้าหมาย เพื่อบริหารสภาพคล่องและเงินทุนจม
              </p>
            </div>
          </div>

          {/* Interactive Threshold Buttons & Toggle Accordion */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
            <span className="text-[11px] text-slate-400 font-medium">เกณฑ์แจ้งเตือน:</span>
            <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
              {[
                { months: 6, label: '6 เดือน' },
                { months: 12, label: '1 ปี (12 ด.)' },
                { months: 24, label: '2 ปี (24 ด.)' },
                { months: 36, label: '3 ปี (36 ด.)' },
              ].map((t) => (
                <button
                  key={t.months}
                  type="button"
                  onClick={() => setAlertThresholdMonths(t.months)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    alertThresholdMonths === t.months
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handlePrintSection('overdue')}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="พิมพ์รายงานเฉพาะแปลงที่ดินถือครองเกินกำหนด (A4 PDF / Print)"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>พิมพ์รายงาน</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAlertsExpanded(!isAlertsExpanded)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title={isAlertsExpanded ? 'ย่อแถบแจ้งเตือน' : 'ขยายแถบแจ้งเตือน'}
            >
              {isAlertsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar for Overdue Plots */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">แปลงถือครองเกินเป้าหมาย</span>
            <span className="text-base sm:text-lg font-bold text-amber-400 font-mono">
              {overduePlots.length} <span className="text-xs font-normal text-slate-400">/ {totalActivePlots} แปลงที่ถือครอง</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">เงินทุนจม (Capital Tied Up)</span>
            <span className="text-base sm:text-lg font-bold text-rose-300 font-mono">
              {formatCurrency(overdueCapitalTiedUp)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">มูลค่าเป้าหมายขาย (KPI Target)</span>
            <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
              {formatCurrency(overdueTargetValue)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block">กำไรเป้าหมายที่รอปลดล็อก</span>
            <span className="text-base sm:text-lg font-bold text-teal-300 font-mono">
              +{formatCurrency(Math.max(0, overdueTargetValue - overdueCapitalTiedUp))}
            </span>
          </div>
        </div>

        {/* Expandable Alert Plot Cards */}
        {isAlertsExpanded && (
          <div className="pt-4 space-y-2.5">
            {overduePlots.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>รายการแปลงที่ดินที่ถือครองเกิน {alertThresholdMonths} เดือน ({overduePlots.length} แปลง):</span>
                  <button
                    onClick={() => {
                      if (onFilterTable) {
                        onFilterTable('holding');
                      } else {
                        onNavigateToTable();
                      }
                    }}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    ดูแปลงทั้งหมดในตาราง <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {overduePlots.map(({ plot, holding }) => (
                    <div
                      key={plot.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 font-bold">
                                #{plot.orderNumber}
                              </span>
                              <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                                {plot.title}
                              </h4>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{plot.subdistrict}, {plot.district}, {plot.province}</span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border flex items-center gap-1 ${
                            holding.monthsHeld >= 36
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : holding.monthsHeld >= 24
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                          }`}>
                            <Clock className="w-3 h-3" />
                            ถือครอง: {holding.formattedDuration}
                          </span>
                        </div>

                        {/* Financial Snapshot */}
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">วันที่ซื้อ:</span>
                            <span className="font-mono text-slate-300">{plot.purchaseDate || '-'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">ต้นทุนจม:</span>
                            <span className="font-mono font-semibold text-rose-300">{formatCurrency(plot.totalCost)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">ราคาตั้งใจขาย:</span>
                            <span className="font-mono font-semibold text-emerald-400">{plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          {holding.monthsHeld >= 24 ? (
                            <span className="text-rose-400 font-semibold">⚠️ แนะนำปรับราคาเร่งขายหรือปล่อยเช่า</span>
                          ) : (
                            <span className="text-amber-400 font-medium">ควรวางแผนการตลาดหรือโปรโมท</span>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSelectPlot(plot)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            ดูแปลง
                          </button>
                          <button
                            type="button"
                            onClick={onNavigateToSimulator}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="ไปคำนวณและจำลองปรับราคาขาย"
                          >
                            <Calculator className="w-3 h-3" />
                            ปรับราคา KPI
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-200">
                  ไม่มีแปลงที่ดินที่ถือครองเกิน {alertThresholdMonths} เดือน
                </p>
                <p className="text-[11px] text-slate-500">
                  พอร์ตการถือครองที่ดินอยู่ในเกณฑ์เวลาที่กำหนด สามารถปรับเกณฑ์แจ้งเตือนด้านบนเพื่อดูระยะเวลาอื่น
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print & PDF Modal for Dashboard */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in no-print">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    พิมพ์รายงาน & ส่งออก PDF แดชบอร์ด KPI
                  </h3>
                  <p className="text-xs text-slate-400">
                    สรุปภาพรวมพอร์ตการลงทุน ตัวชี้วัดสำคัญ และความเสี่ยงการถือครอง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-300">
              {/* Orientation Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  ทิศทางการจัดหน้ากระดาษ (Page Orientation):
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      printOrientation === 'landscape'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40 shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-xs sm:text-sm">แนวนอน (A4 Landscape)</div>
                      {printOrientation === 'landscape' && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                        🌟 แนะนำสำหรับแดชบอร์ด
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      printOrientation === 'portrait'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40 shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-xs sm:text-sm">แนวตั้ง (A4 Portrait)</div>
                      {printOrientation === 'portrait' && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-semibold">
                        มาตรฐาน
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Scope Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  เลือกขอบเขตรายงานแดชบอร์ด:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintScope('all')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'all'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-white">ทั้งพอร์ต</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5 font-bold">
                      {plots.length} แปลง
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintScope('selected');
                      if (selectedPlotIds.length === 0 && plots.length > 0) {
                        setSelectedPlotIds([plots[0].id]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'selected'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-white">เฉพาะที่เลือก</div>
                    <div className="text-[11px] text-cyan-400 font-mono mt-0.5 font-bold">
                      {selectedPlotIds.length > 0 ? `${selectedPlotIds.length} แปลง` : 'เลือกแปลงเอง'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintScope('overdue')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'overdue'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-white">ถือครองเกินกำหนด</div>
                    <div className="text-[11px] text-amber-400 font-mono mt-0.5 font-bold">
                      {overduePlots.length} แปลง
                    </div>
                  </button>
                </div>

                {/* If selected scope, render quick plot checklist */}
                {printScope === 'selected' && (
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 max-h-40 overflow-y-auto">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                      <span>ติ๊กเลือกแปลงที่ต้องการรวมในรายงานแดชบอร์ด:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPlotIds.length === plots.length) setSelectedPlotIds([]);
                          else setSelectedPlotIds(plots.map(p => p.id));
                        }}
                        className="text-emerald-400 hover:underline cursor-pointer"
                      >
                        {selectedPlotIds.length === plots.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {plots.map((p) => {
                        const isChecked = selectedPlotIds.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedPlotIds(prev => 
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              }}
                              className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0"
                            />
                            <span className="font-mono text-emerald-400 font-bold">#{p.orderNumber}</span>
                            <span className="truncate">{p.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-auto">({formatCurrency(p.totalCost)})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Stats preview */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">แปลงในรายงาน</span>
                    <span className="font-bold text-white font-mono text-xs">{dashboardPrintTotals.count} แปลง</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">เนื้อที่รวม</span>
                    <span className="font-bold text-white font-mono text-[11px]">{formatThaiArea(dashboardPrintTotals.totalSqWah)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">ต้นทุนรวม</span>
                    <span className="font-bold text-emerald-400 font-mono text-[11px]">{formatCurrency(dashboardPrintTotals.totalCost)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">ราคาเป้าหมาย</span>
                    <span className="font-bold text-cyan-400 font-mono text-[11px]">{formatCurrency(dashboardPrintTotals.totalTarget)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                disabled={isGeneratingPdf}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                ปิดหน้าต่าง
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleExportPdf('open')}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="เปิดเอกสารรายงานแดชบอร์ด PDF ในแท็บใหม่"
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin text-sky-400" /> : <Eye className="w-4 h-4 text-sky-400" />}
                  <span>เปิดดูเป็น PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleExportPdf('download')}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="ดาวน์โหลดไฟล์ PDF แดชบอร์ด"
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Download className="w-4 h-4 text-white" />}
                  <span>ดาวน์โหลด PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handlePrint}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="สั่งพิมพ์ผ่านเบราว์เซอร์"
                >
                  <Printer className="w-4 h-4 text-slate-300" />
                  <span>สั่งพิมพ์ (Print)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container for Print & PDF Export of Dashboard */}
      <div 
        ref={printReportRef}
        id="printable-dashboard-report" 
        className="hidden print:block p-6 sm:p-8 bg-white text-black font-sans w-full max-w-full box-border"
      >
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold tracking-wider uppercase">
                EXECUTIVE KPI DASHBOARD
              </span>
              <h1 className="text-xl font-extrabold text-black tracking-tight">
                {settings?.portfolioTitle || 'แดชบอร์ดสรุปผลการดำเนินงานและเป้าหมาย KPI'}
              </h1>
            </div>
            <p className="text-[11px] text-slate-700">
              เจ้าของพอร์ต: <span className="font-bold text-black">{settings?.ownerName || 'ผู้ดูแลระบบ'}</span> • สกุลเงิน: <span className="font-semibold text-black">{settings?.currency || 'THB (บาท)'}</span> • เอกสารวิเคราะห์เพื่อการบริหารการลงทุน
            </p>
          </div>
          <div className="text-right text-[10.5px] text-slate-700 space-y-1">
            <p className="font-bold text-slate-950 uppercase tracking-wide">
              {printOrientation === 'landscape' ? 'รูปแบบ: แนวนอน (A4 Landscape)' : 'รูปแบบ: แนวตั้ง (A4 Portrait)'}
            </p>
            <p>วันที่พิมพ์: <span className="font-semibold text-black">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</span></p>
            <p>ขอบเขต: <span className="font-semibold text-black">
              {printScope === 'overdue' ? `แปลงถือครองเกินกำหนด (${dashboardPrintPlots.length} แปลง)` : printScope === 'selected' ? `เฉพาะแปลงที่เลือก (${dashboardPrintPlots.length} แปลง)` : `ทั้งหมดในพอร์ต (${dashboardPrintPlots.length} แปลง)`}
            </span></p>
          </div>
        </div>

        {/* 4 Main KPI Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="text-[10px] font-bold text-slate-600 block uppercase">ต้นทุนรวมทั้งสิ้น</span>
            <span className="text-lg font-extrabold text-black font-mono block mt-1">{formatCurrency(dashboardPrintTotals.totalCost)}</span>
            <span className="text-[9.5px] text-slate-500">ราคาซื้อ: {formatCurrency(dashboardPrintTotals.totalPurchase)}</span>
          </div>

          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="text-[10px] font-bold text-slate-600 block uppercase">ราคาเป้าหมาย (KPI Target)</span>
            <span className="text-lg font-extrabold text-emerald-800 font-mono block mt-1">{formatCurrency(dashboardPrintTotals.totalTarget)}</span>
            <span className="text-[9.5px] text-emerald-700 font-semibold">กำไรคาดหวัง: +{formatCurrency(dashboardPrintTotals.expectedGain)} ({dashboardPrintTotals.roi.toFixed(1)}%)</span>
          </div>

          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="text-[10px] font-bold text-slate-600 block uppercase">เนื้อที่รวมทั้งหมด</span>
            <span className="text-lg font-extrabold text-black font-mono block mt-1">{dashboardPrintTotals.totalRai} ไร่</span>
            <span className="text-[9.5px] text-slate-500">{formatThaiArea(dashboardPrintTotals.totalSqWah)}</span>
          </div>

          <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
            <span className="text-[10px] font-bold text-slate-600 block uppercase">สถานะแปลงที่ดิน</span>
            <span className="text-lg font-extrabold text-black font-mono block mt-1">{dashboardPrintTotals.count} แปลง</span>
            <span className="text-[9.5px] text-slate-600">ถือครอง: {dashboardPrintTotals.holdingCount} • ประกาศขาย: {dashboardPrintTotals.forSaleCount} • ขายแล้ว: {dashboardPrintTotals.soldCount}</span>
          </div>
        </div>

        {/* Compact Analytics & Breakdown for Print */}
        <div className="grid grid-cols-2 gap-4 mb-5 text-[10px] avoid-break">
          {/* Province Breakdown */}
          <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50/70">
            <span className="font-bold text-slate-800 block border-b border-slate-300 pb-1 mb-1.5">
              การกระจายตัวตามจังหวัด (Top Provinces)
            </span>
            <div className="space-y-1">
              {Object.entries(provinceStats).slice(0, 4).map(([prov, stat]) => {
                const percent = kpis.totalAcquisitionCost > 0 ? (stat.cost / kpis.totalAcquisitionCost) * 100 : 0;
                return (
                  <div key={prov} className="flex justify-between items-center text-[9.5px]">
                    <span className="font-semibold text-slate-900">{prov} ({stat.count} แปลง)</span>
                    <span className="font-mono text-slate-700">{formatCurrency(stat.cost)} ({percent.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cost Structure Breakdown */}
          <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50/70">
            <span className="font-bold text-slate-800 block border-b border-slate-300 pb-1 mb-1.5">
              โครงสร้างต้นทุนและค่าใช้จ่ายรวม (Cost Structure)
            </span>
            <div className="space-y-1 text-[9.5px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-800">ราคาซื้อที่ดิน:</span>
                <span className="font-mono font-semibold">{formatCurrency(costBreakdown.purchase)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-800">ค่าธรรมเนียม/ภาษี/อากร:</span>
                <span className="font-mono font-semibold">{formatCurrency(costBreakdown.taxAndFees)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-800">ค่ารังวัด/ตรวจสอบแนวเขต:</span>
                <span className="font-mono font-semibold">{formatCurrency(costBreakdown.survey)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-800">ค่าใช้จ่ายอื่นๆ/พัฒนา:</span>
                <span className="font-mono font-semibold">{formatCurrency(costBreakdown.other)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Plots Summary Table in this scope */}
        <div className="mb-6">
          <h3 className="font-bold text-xs mb-2 text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
            <span>รายการแปลงที่ดินในขอบเขตรายงานนี้</span>
            <span className="font-mono text-[10px] text-slate-600">จำนวน {dashboardPrintPlots.length} แปลง</span>
          </h3>

          <table className="w-full border-collapse border border-slate-300 text-[9.5px] leading-tight table-fixed">
            <thead>
              <tr className="bg-slate-100 text-black border-b border-slate-400 font-bold">
                <th style={{ width: '5%' }} className="py-2 px-1 border border-slate-300 text-center">#</th>
                <th style={{ width: '25%' }} className="py-2 px-2 border border-slate-300 text-left">ชื่อแปลง / เลขโฉนด</th>
                <th style={{ width: '18%' }} className="py-2 px-2 border border-slate-300 text-left">ทำเล (จังหวัด/อำเภอ)</th>
                <th style={{ width: '14%' }} className="py-2 px-2 border border-slate-300 text-right font-mono">เนื้อที่</th>
                <th style={{ width: '14%' }} className="py-2 px-2 border border-slate-300 text-right font-mono">ต้นทุนรวม (บาท)</th>
                <th style={{ width: '14%' }} className="py-2 px-2 border border-slate-300 text-right font-mono">ราคาเป้าหมาย</th>
                <th style={{ width: '10%' }} className="py-2 px-1 border border-slate-300 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {dashboardPrintPlots.map((plot, idx) => (
                <tr key={plot.id} className="border-b border-slate-200 even:bg-slate-50/70">
                  <td className="py-1.5 px-1 border border-slate-300 text-center font-mono font-bold text-slate-800">
                    {plot.orderNumber || idx + 1}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 truncate">
                    <span className="font-bold text-black">{plot.title}</span>
                    {plot.primaryDeedNumber && <span className="text-[9px] text-slate-600 block font-mono">โฉนด {plot.primaryDeedNumber}</span>}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-slate-800 truncate">
                    {plot.district || '-'}, {plot.province || '-'}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">
                    {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono font-bold text-black">
                    {formatCurrency(plot.totalCost)}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono font-bold text-emerald-900">
                    {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : '-'}
                  </td>
                  <td className="py-1.5 px-1 border border-slate-300 text-center font-bold text-[9px]">
                    {plot.status === 'holding' && 'ถือครอง'}
                    {plot.status === 'for_sale' && 'ประกาศขาย'}
                    {plot.status === 'consignment' && 'ขายฝาก'}
                    {plot.status === 'sold' && 'ขายแล้ว'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-b border-slate-900 text-black">
                <td colSpan={3} className="py-2 px-2 text-center border border-slate-300">รวมทั้งสิ้น</td>
                <td className="py-2 px-2 text-right font-mono border border-slate-300">{formatThaiArea(dashboardPrintTotals.totalSqWah)}</td>
                <td className="py-2 px-2 text-right font-mono font-extrabold border border-slate-300">{formatCurrency(dashboardPrintTotals.totalCost)}</td>
                <td className="py-2 px-2 text-right font-mono font-extrabold text-emerald-900 border border-slate-300">{formatCurrency(dashboardPrintTotals.totalTarget)}</td>
                <td className="py-2 px-1 text-center border border-slate-300">-</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signature & Verification Block */}
        <div className="mt-8 grid grid-cols-2 gap-12 pt-6 border-t border-slate-300 text-xs avoid-break">
          <div className="text-center space-y-8">
            <p className="font-bold text-slate-900">ผู้จัดทำรายงาน (Prepared By)</p>
            <div className="border-b border-slate-400 w-52 mx-auto"></div>
            <p className="text-slate-600 text-[11px]">วันที่: ..... / ..... / ..........</p>
          </div>
          <div className="text-center space-y-8">
            <p className="font-bold text-slate-900">ผู้ตรวจสอบ / เจ้าของพอร์ต (Approved By)</p>
            <div className="border-b border-slate-400 w-52 mx-auto"></div>
            <p className="text-slate-600 text-[11px]">วันที่: ..... / ..... / ..........</p>
          </div>
        </div>
      </div>

      {/* PDF Toast Notification */}
      {pdfToast && (
        <div 
          id="pdf-toast-container" 
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold shadow-2xl shadow-emerald-600/40 animate-fade-in no-print"
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-white" />
          <span>{pdfToast}</span>
        </div>
      )}
    </div>
  );
};
