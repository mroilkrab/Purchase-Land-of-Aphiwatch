import React, { useState, useMemo, useRef } from 'react';
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
  Check
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';

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

export const ReportsView: React.FC<ReportsViewProps> = ({
  plots,
  settings,
  onSelectPlot,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedLandType, setSelectedLandType] = useState<string>('all');
  const [reportSubTab, setReportSubTab] = useState<'landType' | 'timeline' | 'performance'>('landType');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccessToast, setPdfSuccessToast] = useState<string | null>(null);
  // Default to Paper / Monochrome-friendly High Contrast Mode for black ink printing
  const [paperPrintMode, setPaperPrintMode] = useState<boolean>(true);
  const reportRef = useRef<HTMLDivElement>(null);

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

  // Total Portfolio Metrics for filtered selection
  const metrics = useMemo(() => {
    let totalCost = 0;
    let totalPurchase = 0;
    let totalTargetSale = 0;
    let totalRealizedSales = 0;
    let totalRealizedCost = 0;
    let totalRealizedProfit = 0;
    let totalSqWah = 0;

    filteredPlots.forEach((p) => {
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

    const activePlots = filteredPlots.filter((p) => p.status !== 'sold');
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
      count: filteredPlots.length,
    };
  }, [filteredPlots]);

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

    filteredPlots.forEach((p) => {
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
  }, [filteredPlots]);

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

    filteredPlots.forEach((p) => {
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
  }, [filteredPlots]);

  // Print Report Handler (Native browser dialog optimized for high-contrast paper)
  const handlePrint = () => {
    // Ensure paper print mode is enabled for maximum black-ink contrast
    const wasPaperMode = paperPrintMode;
    setPaperPrintMode(true);
    setTimeout(() => {
      window.print();
      if (!wasPaperMode) {
        setTimeout(() => setPaperPrintMode(false), 1000);
      }
    }, 150);
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
          {/* Download Report PDF Button (Primary Action using jsPDF) */}
          <button
            onClick={() => handleDownloadPdf('download')}
            disabled={isGeneratingPdf}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isGeneratingPdf 
                ? 'bg-emerald-800 text-emerald-200 cursor-wait shadow-emerald-900/40' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:shadow-emerald-500/40 border border-emerald-400/30'
            }`}
            title="ดาวน์โหลดรายงานสรุปพอร์ตโฟลิโอเป็นไฟล์เอกสาร PDF ด้วย jsPDF บันทึกเก็บไว้ในเครื่อง"
            aria-label="Download Report PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>กำลังดาวน์โหลด PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-white" />
                <span>ดาวน์โหลดรายงาน PDF (Download PDF)</span>
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
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">เปิดดู</span> PDF
          </button>

          {/* Print Report Dialog */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-600 hover:border-emerald-500/60 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-slate-900/30 transition-all cursor-pointer"
            title="พิมพ์รายงาน (Print) สรุปผลกำไร-ขาดทุน และตารางวิเคราะห์ทั้งหมดผ่านหน้าต่างเบราว์เซอร์"
            aria-label="Print Report"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>พิมพ์รายงาน (Print)</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            📈 แนวโน้มการลงทุนและผลตอบแทนย้อนหลัง (Historical Trend)
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

        {/* Sub-view 1: Report Grouped By Land Type */}
        <div className={`space-y-6 ${reportSubTab === 'landType' || isGeneratingPdf ? 'block' : 'hidden print:block avoid-break'}`}>
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
        <div className={`space-y-6 ${reportSubTab === 'timeline' || isGeneratingPdf ? 'block' : 'hidden print:block page-break-before avoid-break'}`}>
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
        <div className={`space-y-6 ${reportSubTab === 'performance' || isGeneratingPdf ? 'block' : 'hidden print:block page-break-before avoid-break'}`}>
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
                {[...filteredPlots]
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
                {[...filteredPlots]
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
        <div className={`p-5 rounded-xl border space-y-3 avoid-break ${
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
    </div>
);
};
