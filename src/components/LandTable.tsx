import React, { useState, useMemo, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Search, 
  Filter, 
  MapPin, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  Image as ImageIcon,
  Copy,
  FileSpreadsheet,
  X,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  Coins,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Cloud,
  Table as TableIcon,
  LayoutGrid,
  ArrowRightLeft,
  Calendar,
  Building,
  Tag,
  Clock,
  AlertTriangle,
  Printer,
  Receipt,
  Download,
  Loader2,
  Check
} from 'lucide-react';
import { LandPlot, LandStatus, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea, calculatePlotHoldingInfo } from '../services/storage';
import { LandComparisonModal } from './LandComparisonModal';
import { getPlotLandTax, TAX_USAGE_CONFIGS } from '../services/landTax';
import { triggerPrint } from '../utils/print';

interface LandTableProps {
  plots: LandPlot[];
  initialSearchTerm?: string;
  initialStatusFilter?: string;
  onSelectPlot: (plot: LandPlot) => void;
  onEditPlot: (plot: LandPlot) => void;
  onDeletePlot: (plotId: string) => void;
  onDuplicatePlot: (plot: LandPlot) => void;
  onAddNewPlot: () => void;
  onExportCsv: () => void;
  isSyncingSheet?: boolean;
  sheetSyncStatus?: {
    status: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
    sheetUrl?: string;
    lastSynced?: string;
  };
  onSyncSheet?: () => void;
  googleSheetId?: string;
  isGoogleAuthed?: boolean;
  onLoginGoogle?: () => void;
  settings?: PortfolioSettings;
}

type PriceRangePreset = 'all' | 'under_100k' | '100k_500k' | '500k_1m' | '1m_5m' | 'over_5m' | 'custom';
type SortOption = 'order_asc' | 'order_desc' | 'cost_desc' | 'cost_asc' | 'area_desc' | 'area_asc' | 'target_desc';

export const LandTable: React.FC<LandTableProps> = ({
  plots,
  initialSearchTerm,
  initialStatusFilter,
  onSelectPlot,
  onEditPlot,
  onDeletePlot,
  onDuplicatePlot,
  onAddNewPlot,
  onExportCsv,
  isSyncingSheet = false,
  sheetSyncStatus,
  onSyncSheet,
  googleSheetId,
  isGoogleAuthed = false,
  onLoginGoogle,
  settings,
}) => {
  // View mode: 'table' (full spreadsheet) or 'cards' (responsive grid fitting every screen)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Print Report & PDF export state
  const printReportRef = useRef<HTMLDivElement>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printScope, setPrintScope] = useState<'selected' | 'filtered' | 'all'>('filtered');
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // Multi-select for Land Comparison
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState<boolean>(false);

  // State for in-app delete confirmation modal
  const [plotToDelete, setPlotToDelete] = useState<LandPlot | null>(null);

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [holdingAlertFilter, setHoldingAlertFilter] = useState<'all' | 'exceeded_12' | 'exceeded_24'>('all');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [landTypeFilter, setLandTypeFilter] = useState<string>('all');
  const [pricePreset, setPricePreset] = useState<PriceRangePreset>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('order_asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Synchronize incoming search query or status filter from parent (e.g. from Dashboard alerts)
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    if (initialStatusFilter !== undefined) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const [expandedPlots, setExpandedPlots] = useState<Record<string, boolean>>({
    'plot-1': true,
    'plot-10': true,
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPlots((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectPlot = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlotIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPlotIds.length === filteredPlots.length) {
      setSelectedPlotIds([]);
    } else {
      setSelectedPlotIds(filteredPlots.map((p) => p.id));
    }
  };

  // Distinct Provinces
  const provinces = useMemo(() => {
    return Array.from(new Set(plots.map((p) => p.province).filter(Boolean))).sort();
  }, [plots]);

  // Distinct Districts (filtered by selected province if any)
  const districts = useMemo(() => {
    const list = plots
      .filter((p) => provinceFilter === 'all' || p.province === provinceFilter)
      .map((p) => p.district)
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [plots, provinceFilter]);

  // Distinct Land Types
  const landTypes = useMemo(() => {
    return Array.from(new Set(plots.map((p) => p.landType).filter(Boolean))).sort();
  }, [plots]);

  // Counts by Status
  const statusCounts = useMemo(() => {
    return {
      all: plots.length,
      holding: plots.filter((p) => p.status === 'holding').length,
      for_sale: plots.filter((p) => p.status === 'for_sale').length,
      consignment: plots.filter((p) => p.status === 'consignment').length,
      sold: plots.filter((p) => p.status === 'sold').length,
    };
  }, [plots]);

  // Holding Period Overdue Counts (Unsold plots exceeding 12 or 24 months)
  const overdueCounts = useMemo(() => {
    let exceeded_12 = 0;
    let exceeded_24 = 0;
    plots.forEach((p) => {
      if (p.status !== 'sold') {
        const info = calculatePlotHoldingInfo(p.purchaseDate);
        if (info.isValid) {
          if (info.monthsHeld >= 12) exceeded_12++;
          if (info.monthsHeld >= 24) exceeded_24++;
        }
      }
    });
    return { exceeded_12, exceeded_24 };
  }, [plots]);

  // Top Location Tags (Top 7 provinces and districts)
  const topLocationTags = useMemo(() => {
    const tagsMap: Record<string, { type: 'province' | 'district'; name: string; count: number }> = {};
    plots.forEach((p) => {
      if (p.province && p.province.trim()) {
        const key = `prov:${p.province.trim()}`;
        if (!tagsMap[key]) tagsMap[key] = { type: 'province', name: p.province.trim(), count: 0 };
        tagsMap[key].count++;
      }
      if (p.district && p.district.trim()) {
        const key = `dist:${p.district.trim()}`;
        if (!tagsMap[key]) tagsMap[key] = { type: 'district', name: p.district.trim(), count: 0 };
        tagsMap[key].count++;
      }
    });
    return Object.values(tagsMap).sort((a, b) => b.count - a.count).slice(0, 7);
  }, [plots]);

  // Check how many filters are active
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim() !== '') count++;
    if (statusFilter !== 'all') count++;
    if (holdingAlertFilter !== 'all') count++;
    if (provinceFilter !== 'all') count++;
    if (districtFilter !== 'all') count++;
    if (landTypeFilter !== 'all') count++;
    if (pricePreset !== 'all') count++;
    if (minPrice !== '' || maxPrice !== '') count++;
    return count;
  }, [searchTerm, statusFilter, holdingAlertFilter, provinceFilter, districtFilter, landTypeFilter, pricePreset, minPrice, maxPrice]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setHoldingAlertFilter('all');
    setProvinceFilter('all');
    setDistrictFilter('all');
    setLandTypeFilter('all');
    setPricePreset('all');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('order_asc');
  };

  // Filter and sort plots
  const filteredPlots = useMemo(() => {
    return plots
      .filter((plot) => {
        // 1. Text Search Filter (Case insensitive across all relevant fields)
        if (searchTerm.trim() !== '') {
          const query = searchTerm.toLowerCase().trim();
          const matchesTitle = plot.title?.toLowerCase().includes(query);
          const matchesDeed = plot.primaryDeedNumber?.toLowerCase().includes(query);
          const matchesProvince = plot.province?.toLowerCase().includes(query);
          const matchesDistrict = plot.district?.toLowerCase().includes(query);
          const matchesSubdistrict = plot.subdistrict?.toLowerCase().includes(query);
          const matchesNotes = plot.notes?.toLowerCase().includes(query);
          const matchesLandType = plot.landType?.toLowerCase().includes(query);
          const matchesOrder = String(plot.orderNumber) === query;
          const matchesSubDeed = plot.subParcels?.some((sp) =>
            sp.deedNumber?.toLowerCase().includes(query) || sp.notes?.toLowerCase().includes(query)
          );

          if (!matchesTitle && !matchesDeed && !matchesProvince && !matchesDistrict && !matchesSubdistrict && !matchesNotes && !matchesLandType && !matchesOrder && !matchesSubDeed) {
            return false;
          }
        }

        // 2. Status Filter
        if (statusFilter !== 'all' && plot.status !== statusFilter) {
          return false;
        }

        // 3. Province Filter
        if (provinceFilter !== 'all' && plot.province !== provinceFilter) {
          return false;
        }

        // 4. District Filter
        if (districtFilter !== 'all' && plot.district !== districtFilter) {
          return false;
        }

        // 5. Land Type Filter
        if (landTypeFilter !== 'all' && plot.landType !== landTypeFilter) {
          return false;
        }

        // 6. Price Range Preset Filter (Based on totalCost)
        const cost = plot.totalCost || 0;
        if (pricePreset === 'under_100k' && cost >= 100000) return false;
        if (pricePreset === '100k_500k' && (cost < 100000 || cost > 500000)) return false;
        if (pricePreset === '500k_1m' && (cost < 500000 || cost > 1000000)) return false;
        if (pricePreset === '1m_5m' && (cost < 1000000 || cost > 5000000)) return false;
        if (pricePreset === 'over_5m' && cost <= 5000000) return false;

        // Custom Price Range Filter
        if (pricePreset === 'custom') {
          if (minPrice !== '' && !isNaN(Number(minPrice)) && cost < Number(minPrice)) {
            return false;
          }
          if (maxPrice !== '' && !isNaN(Number(maxPrice)) && cost > Number(maxPrice)) {
            return false;
          }
        }

        // 7. Holding Period Alert Tag Filter
        if (holdingAlertFilter === 'exceeded_12') {
          if (plot.status === 'sold') return false;
          const info = calculatePlotHoldingInfo(plot.purchaseDate);
          if (!info.isValid || info.monthsHeld < 12) return false;
        }
        if (holdingAlertFilter === 'exceeded_24') {
          if (plot.status === 'sold') return false;
          const info = calculatePlotHoldingInfo(plot.purchaseDate);
          if (!info.isValid || info.monthsHeld < 24) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sorting logic
        switch (sortBy) {
          case 'order_asc':
            return (a.orderNumber || 0) - (b.orderNumber || 0);
          case 'order_desc':
            return (b.orderNumber || 0) - (a.orderNumber || 0);
          case 'cost_desc':
            return (b.totalCost || 0) - (a.totalCost || 0);
          case 'cost_asc':
            return (a.totalCost || 0) - (b.totalCost || 0);
          case 'area_desc':
            return (b.totalSqWah || 0) - (a.totalSqWah || 0);
          case 'area_asc':
            return (a.totalSqWah || 0) - (b.totalSqWah || 0);
          case 'target_desc':
            return (b.targetSalePrice || 0) - (a.targetSalePrice || 0);
          default:
            return 0;
        }
      });
  }, [plots, searchTerm, statusFilter, holdingAlertFilter, provinceFilter, districtFilter, landTypeFilter, pricePreset, minPrice, maxPrice, sortBy]);

  // Aggregate stats for filtered plots
  const totalCostFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0), [filteredPlots]);
  const totalPurchaseFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.purchasePrice) || 0), 0), [filteredPlots]);
  const totalTaxFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.taxAndFees) || 0), 0), [filteredPlots]);
  const totalSurveyFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.surveyCost) || 0), 0), [filteredPlots]);
  const totalOtherFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.otherExpenses) || 0), 0), [filteredPlots]);
  const totalTargetSaleFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.targetSalePrice) || 0), 0), [filteredPlots]);
  const totalSqWahFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + (Number(p.totalSqWah) || 0), 0), [filteredPlots]);
  const totalLandTaxFiltered = useMemo(() => filteredPlots.reduce((sum, p) => sum + getPlotLandTax(p).annualTax, 0), [filteredPlots]);

  // Selected plots for printing based on user choice ('selected' | 'filtered' | 'all')
  const printPlots = useMemo(() => {
    if (printScope === 'selected') {
      const selected = plots.filter((p) => selectedPlotIds.includes(p.id));
      return selected.length > 0 ? selected : filteredPlots;
    }
    return printScope === 'all' ? plots : filteredPlots;
  }, [printScope, plots, filteredPlots, selectedPlotIds]);

  // Quick single-plot print helper
  const handlePrintSinglePlot = (plot: LandPlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlotIds([plot.id]);
    setPrintScope('selected');
    setIsPrintModalOpen(true);
  };

  const printTotals = useMemo(() => {
    let totalSqWah = 0;
    let totalPurchase = 0;
    let totalFees = 0;
    let totalCost = 0;
    let totalTargetOrSold = 0;

    let totalAnnualLandTax = 0;

    printPlots.forEach((p) => {
      totalSqWah += Number(p.totalSqWah) || 0;
      totalPurchase += Number(p.purchasePrice) || 0;
      const fees = (Number(p.taxAndFees) || 0) + (Number(p.surveyCost) || 0) + (Number(p.otherExpenses) || 0);
      totalFees += fees;
      totalCost += Number(p.totalCost) || 0;
      const targetOrSold = p.status === 'sold' ? (Number(p.soldPrice) || 0) : (Number(p.targetSalePrice) || 0);
      totalTargetOrSold += targetOrSold;
      const taxInfo = getPlotLandTax(p);
      totalAnnualLandTax += taxInfo.annualTax;
    });

    return {
      totalPlots: printPlots.length,
      totalSqWah,
      totalPurchase,
      totalFees,
      totalCost,
      totalTargetOrSold,
      totalAnnualLandTax,
    };
  }, [printPlots]);

  // Native Browser Print dialog with dynamic orientation and automatic cleanup
  const handlePrint = () => {
    setIsPrintModalOpen(false);
    triggerPrint(printOrientation);
  };

  // High-Resolution Executive PDF Export & New Tab Viewer via jsPDF + html2canvas
  const handleExportPdf = async (action: 'download' | 'open') => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const element = printReportRef.current;
      if (!element) {
        throw new Error('ไม่พบข้อมูลเอกสารรายงานตารางที่ดิน');
      }

      if (document.fonts) {
        await document.fonts.ready;
      }

      const isLandscape = printOrientation === 'landscape';
      
      // Temporarily remove hidden and position off-screen with fixed width for immaculate html2canvas rendering
      const hadHidden = element.classList.contains('hidden');
      if (hadHidden) {
        element.classList.remove('hidden');
      }

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

      // Settle DOM
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
          el.classList?.contains('management-control') ||
          el.tagName === 'BUTTON',
      });

      // Restore element styles
      element.style.display = prevDisplay;
      element.style.position = prevPosition;
      element.style.left = prevLeft;
      element.style.top = prevTop;
      element.style.width = prevWidth;
      element.style.zIndex = prevZ;
      if (hadHidden) {
        element.classList.add('hidden');
      }

      const pdf = new jsPDF({
        orientation: isLandscape ? 'l' : 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 8;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

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

      // Add page numbering on each page
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(51, 65, 85);
        pdf.text(
          `Page ${i} of ${totalPages} • Land Portfolio Ledger (${isLandscape ? 'A4 Landscape' : 'A4 Portrait'}) • ${new Date().toISOString().slice(0, 10)}`,
          pageWidth / 2,
          pageHeight - 4,
          { align: 'center' }
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Land_Portfolio_Ledger_${printScope}_${dateStr}.pdf`;

      if (action === 'download') {
        pdf.save(fileName);
        setPdfToast('ดาวน์โหลดเอกสารรายงานบัญชีแปลงที่ดิน (PDF) เรียบร้อยแล้ว!');
      } else {
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const opened = window.open(blobUrl, '_blank');
        if (!opened) {
          pdf.save(fileName);
          setPdfToast('เปิดในแท็บใหม่ถูกบล็อก จึงบันทึกไฟล์ PDF ให้เรียบร้อย');
        } else {
          setPdfToast('เปิดดูเอกสารรายงานบัญชี (PDF) ในแท็บใหม่เรียบร้อยแล้ว!');
        }
      }

      setIsPrintModalOpen(false);
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err: any) {
      console.warn('PDF generation encountered an issue, launching print fallback:', err);
      setIsPrintModalOpen(false);
      setTimeout(() => {
        triggerPrint(printOrientation);
      }, 200);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Interactive Controls & Tables - 100% Hidden in Print/PDF */}
      <div className="space-y-4 max-w-full print:hidden no-print management-control">
        {/* Google Sheets Auto-Sync Notification Bar */}
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white">ระบบอัปเดต Google Sheet อัตโนมัติ</span>
              {isSyncingSheet ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> กำลังซิงค์...
                </span>
              ) : isGoogleAuthed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-2.5 h-2.5" /> ซิงค์อัตโนมัติเปิดใช้งาน
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  รอเชื่อมต่อ Google
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
              {isGoogleAuthed 
                ? (sheetSyncStatus?.message || 'ทุกการ เพิ่มแปลงใหม่, แก้ไขข้อมูล หรือ ลบแปลงที่ดิน จะถูกอัปเดตเข้า Google Sheet ให้ทันที')
                : 'เข้าสู่ระบบ Google เพื่อเปิดใช้งานระบบอัปเดต Google Sheet อัตโนมัติทุกครั้งที่มีการเพิ่ม แก้ไข หรือลบข้อมูล'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {sheetSyncStatus?.sheetUrl && (
            <a
              href={sheetSyncStatus.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิด Google Sheet</span>
            </a>
          )}
          {isGoogleAuthed && onSyncSheet && (
            <button
              onClick={onSyncSheet}
              disabled={isSyncingSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              title="กดเพื่อส่งข้อมูลทั้งหมดเข้า Google Sheet ทันที"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheet ? 'กำลังซิงค์...' : 'ซิงค์ Google Sheet ตอนนี้'}</span>
            </button>
          )}
          {!isGoogleAuthed && onLoginGoogle && (
            <button
              onClick={onLoginGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              <span>เข้าสู่ระบบ Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Toolbar: Search Bar, View Mode Switcher, Quick Filters, Export, Add */}
      <div id="land-table-toolbar" className="p-3.5 sm:p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Enhanced Search Input */}
          <div id="land-table-search-bar" className="relative flex-1 min-w-0 max-w-xl">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อแปลง, เลขโฉนด, ตำบล, อำเภอ, จังหวัด..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-700 cursor-pointer"
                title="ล้างข้อความค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Row: Dual View Toggle (Table / Cards), Filters, Export, Add */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700 shrink-0 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="ตารางบัญชีแบบละเอียด (Financial Ledger)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ตารางบัญชี</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="มุมมองการ์ดสรุปแปลงที่ดิน (พอดีหน้าจอ ไม่ล้น)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">การ์ดสรุป</span>
              </button>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ตัวกรอง</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์ CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-xs"
              title="พิมพ์รายงานหรือส่งออกเป็น PDF คุณภาพสูง (A4 แนวนอน / แนวตั้ง)"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>พิมพ์ / PDF</span>
            </button>

            <button
              onClick={onAddNewPlot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มแปลงที่ดิน</span>
            </button>
          </div>
        </div>

        {/* Real-Time Interactive Tag Chips Bar (Quick Filters for Status, Alert, & Locations) */}
        <div id="land-table-filters" className="pt-2.5 border-t border-slate-800/80 space-y-2">
          {/* Status & Alert Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
              <Tag className="w-3.5 h-3.5 text-emerald-400" /> แท็กด่วน:
            </span>

            {[
              { id: 'all', label: 'ทั้งหมด', count: statusCounts.all },
              { id: 'holding', label: '🟢 ถือครอง', count: statusCounts.holding },
              { id: 'for_sale', label: '🔵 ประกาศขาย', count: statusCounts.for_sale },
              { id: 'consignment', label: '🟠 ขายฝาก', count: statusCounts.consignment },
              { id: 'sold', label: '🔴 ขายแล้ว', count: statusCounts.sold },
            ].map((st) => {
              const isActive = statusFilter === st.id && holdingAlertFilter === 'all';
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.id);
                    setHoldingAlertFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-emerald-700 text-white' : 'bg-slate-900/80 text-slate-400'
                  }`}>
                    {st.count}
                  </span>
                </button>
              );
            })}

            {/* Holding Alert Chips: > 12 Months and > 24 Months */}
            {overdueCounts.exceeded_12 > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (holdingAlertFilter === 'exceeded_12') {
                    setHoldingAlertFilter('all');
                  } else {
                    setHoldingAlertFilter('exceeded_12');
                    setStatusFilter('all');
                  }
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                  holdingAlertFilter === 'exceeded_12'
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-950/40 ring-1 ring-amber-300'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                }`}
                title="กรองเฉพาะแปลงที่ถือครองเกิน 1 ปี โดยยังไม่ได้ขาย"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>ถือครอง &gt; 1 ปี</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 font-mono font-bold">
                  {overdueCounts.exceeded_12}
                </span>
              </button>
            )}

            {overdueCounts.exceeded_24 > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (holdingAlertFilter === 'exceeded_24') {
                    setHoldingAlertFilter('all');
                  } else {
                    setHoldingAlertFilter('exceeded_24');
                    setStatusFilter('all');
                  }
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                  holdingAlertFilter === 'exceeded_24'
                    ? 'bg-rose-500 text-white font-bold border-rose-400 shadow-md shadow-rose-950/40 ring-1 ring-rose-300'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                }`}
                title="กรองเฉพาะแปลงที่ถือครองเกิน 2 ปี โดยยังไม่ได้ขาย"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ถือครอง &gt; 2 ปี</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 font-mono font-bold">
                  {overdueCounts.exceeded_24}
                </span>
              </button>
            )}
          </div>

          {/* Location Tags Row (Provinces and Districts) */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" /> ทำเล:
            </span>
            {topLocationTags.map((loc) => {
              const isSelected = loc.type === 'province' ? provinceFilter === loc.name : districtFilter === loc.name;
              return (
                <button
                  key={`${loc.type}-${loc.name}`}
                  type="button"
                  onClick={() => {
                    if (loc.type === 'province') {
                      setProvinceFilter(provinceFilter === loc.name ? 'all' : loc.name);
                      setDistrictFilter('all');
                    } else {
                      setDistrictFilter(districtFilter === loc.name ? 'all' : loc.name);
                    }
                  }}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold shadow-sm ring-1 ring-cyan-400/50'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{loc.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({loc.count})</span>
                </button>
              );
            })}

            {/* Quick Reset All Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-0.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 flex items-center gap-1 transition-all cursor-pointer ml-auto"
              >
                <RotateCcw className="w-3 h-3" /> ล้างตัวกรอง ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid (Status, Location, Price Range, Land Type, Sort) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
          {/* 1. Status Dropdown */}
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              สถานะแปลง:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="all">ทุกสถานะ (All)</option>
              <option value="holding">🟢 ถือครอง (Holding)</option>
              <option value="for_sale">🔵 กำลังประกาศขาย</option>
              <option value="consignment">🟠 รับขายฝาก</option>
              <option value="sold">🔴 ขายแล้ว (Sold)</option>
            </select>
          </div>

          {/* 2. Location - Province Dropdown */}
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              ทำเล: จังหวัด
            </label>
            <select
              value={provinceFilter}
              onChange={(e) => {
                setProvinceFilter(e.target.value);
                setDistrictFilter('all');
              }}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="all">ทุกจังหวัด</option>
              {provinces.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Location - District Dropdown */}
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              ทำเล: อำเภอ/เขต
            </label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="all">ทุกอำเภอ/เขต</option>
              {districts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Price Range Dropdown */}
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              ช่วงราคาต้นทุน:
            </label>
            <select
              value={pricePreset}
              onChange={(e) => setPricePreset(e.target.value as PriceRangePreset)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="all">ทุกช่วงราคา (All)</option>
              <option value="under_100k">&lt; 100K บาท</option>
              <option value="100k_500k">100K - 500K บาท</option>
              <option value="500k_1m">500K - 1M บาท</option>
              <option value="1m_5m">1M - 5M บาท</option>
              <option value="over_5m">&gt; 5,000,000 บาท</option>
              <option value="custom">ระบุเอง...</option>
            </select>
          </div>

          {/* 5. Land Type Dropdown */}
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              ประเภทที่ดิน:
            </label>
            <select
              value={landTypeFilter}
              onChange={(e) => setLandTypeFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="all">ทุกประเภท (All)</option>
              {landTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Sorting Dropdown */}
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-400 font-medium mb-1">
              เรียงลำดับ:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              <option value="order_asc">ลำดับแปลง (1 - 10)</option>
              <option value="order_desc">ลำดับแปลง (ล่าสุด)</option>
              <option value="cost_desc">ต้นทุนรวม (มากไปน้อย)</option>
              <option value="cost_asc">ต้นทุนรวม (น้อยไปมาก)</option>
              <option value="area_desc">ขนาดเนื้อที่ (ใหญ่สุด)</option>
              <option value="area_asc">ขนาดเนื้อที่ (เล็กสุด)</option>
              <option value="target_desc">ราคาตั้งใจขาย (มากสุด)</option>
            </select>
          </div>
        </div>

        {/* Custom Price Inputs (if chosen) */}
        {pricePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-300 font-medium">ช่วงราคาต้นทุนที่กำหนดเอง:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="ต่ำสุด (บาท)"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-32 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono"
              />
              <span className="text-slate-500">-</span>
              <input
                type="number"
                placeholder="สูงสุด (บาท)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-32 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* Filter Summary & Active Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">
              ผลการค้นหา: <strong className="text-emerald-400 font-mono">{filteredPlots.length}</strong> จาก {plots.length} แปลง
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400">
              เนื้อที่รวม: <strong className="text-amber-400 font-mono">{(totalSqWahFiltered / 400).toFixed(2)} ไร่</strong> ({totalSqWahFiltered.toLocaleString('th-TH')} ตร.ว.)
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400">
              ต้นทุนรวม: <strong className="text-white font-mono">{formatCurrency(totalCostFiltered)}</strong>
            </span>
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> ล้างตัวกรอง ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: RESPONSIVE CARDS GRID (100% Fit & No Overflow) */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span>มุมมองการ์ดสรุปแปลงที่ดิน (แสดงผลพอดีหน้าจอ เหมาะกับมือถือและแท็บเล็ต)</span>
            <button
              onClick={() => setViewMode('table')}
              className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <TableIcon className="w-3.5 h-3.5" /> สลับเป็นตารางบัญชี
            </button>
          </div>

          {filteredPlots.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2 bg-slate-900/60 rounded-2xl border border-slate-800">
              <div className="text-slate-400 font-medium text-sm">ไม่พบแปลงที่ดินตามเงื่อนไขที่เลือก</div>
              <button
                onClick={handleResetFilters}
                className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold cursor-pointer border border-slate-700 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> ล้างตัวกรอง
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
              {filteredPlots.map((plot) => {
                const hasSubParcels = plot.subParcels && plot.subParcels.length > 0;
                const isExpanded = expandedPlots[plot.id];
                const otherCosts = (plot.taxAndFees || 0) + (plot.surveyCost || 0) + (plot.otherExpenses || 0);
                const projectedProfit = (plot.targetSalePrice || 0) - (plot.totalCost || 0);

                return (
                  <div
                    key={plot.id}
                    onClick={() => onSelectPlot(plot)}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-950/20 transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative min-w-0"
                  >
                    {/* Top Row: Select Checkbox, Order Badge, Status, Land Type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedPlotIds.includes(plot.id)}
                          onChange={(e) => toggleSelectPlot(plot.id, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                          title="เลือกเพื่อเปรียบเทียบ"
                        />
                        <span className="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-slate-700">
                          #{plot.orderNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {plot.landType}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
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
                          ? 'รับขายฝาก'
                          : plot.status === 'for_sale'
                          ? 'กำลังประกาศขาย'
                          : 'ถือครอง'}
                      </span>
                    </div>

                    {/* Title & Deed Info */}
                    <div>
                      <h4 className="font-bold text-slate-100 text-base group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {plot.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="font-mono">
                          โฉนด: <strong className="text-slate-200">{plot.primaryDeedNumber || '-'}</strong>
                        </span>
                        {hasSubParcels && (
                          <span className="text-[11px] font-medium text-emerald-400">
                            (+{plot.subParcels?.length} โฉนดย่อย)
                          </span>
                        )}
                        {plot.purchaseDate && (
                          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            ซื้อ: {plot.purchaseDate}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Location & Map button */}
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-slate-300 min-w-0 truncate">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{plot.subdistrict}, {plot.district}, {plot.province}</span>
                      </div>
                      {plot.mapsUrl && (
                        <a
                          href={plot.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-semibold border border-blue-500/30 flex items-center gap-1 transition-colors shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Google Maps</span>
                        </a>
                      )}
                    </div>

                    {/* Land Area Spec */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">ขนาดเนื้อที่</span>
                        <span className="font-semibold text-slate-200 font-mono">
                          {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                        </span>
                        {plot.partiallySoldTotalSqWah && plot.partiallySoldTotalSqWah > 0 ? (
                          <span className="text-[10px] text-amber-400 block mt-0.5">
                            ขายไป: {formatThaiArea(plot.partiallySoldRai || 0, plot.partiallySoldNgan || 0, plot.partiallySoldSqWah || 0)}
                          </span>
                        ) : null}
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">รวมตารางวา</span>
                        <span className="font-semibold text-amber-400 font-mono">
                          {Number(plot.totalSqWah ?? 0).toLocaleString('th-TH')} ตร.ว.
                        </span>
                        {plot.remainingSqWah !== undefined && plot.remainingSqWah !== null && plot.partiallySoldTotalSqWah && plot.partiallySoldTotalSqWah > 0 ? (
                          <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                            คงเหลือ {Number(plot.remainingSqWah).toLocaleString('th-TH')} ตร.ว.
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Financial Summary Highlight Box */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-400">ต้นทุนรวมทั้งสิ้น:</span>
                        <span className="font-bold font-mono text-white text-sm">
                          {formatCurrency(plot.totalCost)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px]">
                        <span className="text-slate-500">ราคาซื้อเดิม:</span>
                        <span className="font-mono text-slate-300">{formatCurrency(plot.purchasePrice)}</span>
                      </div>
                      {otherCosts > 0 && (
                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-500">ภาษี/รังวัด/อื่นๆ:</span>
                          <span className="font-mono text-slate-400">+{formatCurrency(otherCosts)}</span>
                        </div>
                      )}
                      {(() => {
                        const plotTax = getPlotLandTax(plot);
                        return (
                          <div className="flex justify-between items-baseline text-[11px] text-rose-300">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Receipt className="w-3 h-3 text-rose-400" />
                              ภาษีที่ดิน/ปี:
                            </span>
                            <span className="font-mono font-medium text-rose-300">
                              {plotTax.annualTax === 0 ? '0 ฿ (ยกเว้น)' : `${formatCurrency(plotTax.annualTax)}`}
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-800">
                        <span className="text-emerald-400 font-semibold">ราคาตั้งใจขาย (KPI):</span>
                        <span className="font-bold font-mono text-emerald-400">
                          {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : '-'}
                        </span>
                      </div>
                      {projectedProfit > 0 && (
                        <div className="flex justify-between items-baseline text-[10px] text-slate-400">
                          <span>กำไรคาดหวัง:</span>
                          <span className="text-emerald-400 font-mono font-semibold">
                            +{formatCurrency(projectedProfit)} ({((projectedProfit / (plot.totalCost || 1)) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sub-parcels Quick View (if subdivided) */}
                    {hasSubParcels && (
                      <div className="text-[11px] pt-1 border-t border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleExpand(plot.id, e)}
                          className="w-full flex items-center justify-between text-slate-400 hover:text-emerald-400 transition-colors py-1 cursor-pointer"
                        >
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-emerald-400" />
                            โฉนดย่อย ({plot.subParcels?.length} แปลง)
                          </span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {isExpanded && (
                          <div className="space-y-1 mt-1 pl-2 border-l border-emerald-500/40">
                            {plot.subParcels!.map((sp, idx) => (
                              <div key={sp.id} className="flex justify-between items-center text-[10px] text-slate-400 py-0.5">
                                <span>โฉนด {sp.deedNumber} ({formatThaiArea(sp.rai, sp.ngan, sp.sqWah)})</span>
                                {sp.mapsUrl && (
                                  <a href={sp.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                    แผนที่
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div 
                      className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1 text-xs" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onSelectPlot(plot)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ดูละเอียด</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPlot(plot);
                        }}
                        className="py-1.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer text-[11px]"
                        title="แก้ไขข้อมูลแปลงนี้"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>แก้ไข</span>
                      </button>

                      <button
                        onClick={() => onDuplicatePlot(plot)}
                        className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                        title="คัดลอก/ทำซ้ำแปลงนี้"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setPlotToDelete(plot)}
                        className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        title="ลบแปลงนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: FULL FINANCIAL LEDGER TABLE */}
      {viewMode === 'table' && (
        <div className="space-y-2">
          {/* Subtle horizontal scroll helper banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>เลื่อนแนวนอน ↔ เพื่อดูคอลัมน์การเงินทั้งหมด (ปุ่ม &quot;จัดการ&quot; จะตรึงอยู่ด้านขวาสุดเสมอ)</span>
            </div>
            <button
              onClick={() => setViewMode('cards')}
              className="text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>สลับเป็นมุมมองการ์ด (พอดีหน้าจอ)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg relative max-w-full">
            <table id="main-land-table" className="w-full text-left text-xs border-separate border-spacing-0 min-w-[1360px]">
              <thead>
                <tr className="bg-slate-800/90 border-b border-slate-700 text-slate-300 font-semibold sticky top-0 z-20">
                  <th className="py-3 px-2 w-8 text-center border-b border-slate-700">
                    <input
                      type="checkbox"
                      checked={filteredPlots.length > 0 && selectedPlotIds.length === filteredPlots.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                      title="เลือกทั้งหมด"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center border-b border-slate-700">ลำดับ</th>
                  <th className="py-3 px-3 w-24 border-b border-slate-700">วันที่ซื้อ</th>
                  <th className="py-3 px-3 w-24 border-b border-slate-700">วันที่ขาย</th>
                  <th className="py-3 px-4 min-w-[220px] border-b border-slate-700">รายละเอียดที่ดิน / ประเภท</th>
                  <th className="py-3 px-3 border-b border-slate-700">ตำบล/อำเภอ/จังหวัด</th>
                  <th className="py-3 px-3 border-b border-slate-700">เลขที่ดิน</th>
                  <th className="py-3 px-3 text-center border-b border-slate-700">พิกัด Maps</th>
                  <th className="py-3 px-3 text-right border-b border-slate-700">เนื้อที่ (ไร่-งาน-วา)</th>
                  <th className="py-3 px-3 text-right border-b border-slate-700">รวม ตร.ว.</th>
                  <th className="py-3 px-3 text-right border-b border-slate-700">ราคาซื้อ</th>
                  <th className="py-3 px-3 text-right border-b border-slate-700">ภาษี/รังวัด/อื่นๆ</th>
                  <th className="py-3 px-3 text-right font-bold text-white bg-slate-800 border-b border-slate-700">ต้นทุนรวมทั้งสิ้น</th>
                  <th className="py-3 px-3 text-right text-rose-300 border-b border-slate-700">ภาษีที่ดิน/ปี</th>
                  <th className="py-3 px-3 text-right text-emerald-400 border-b border-slate-700">ราคาตั้งใจขาย (KPI)</th>
                  <th className="py-3 px-3 text-center border-b border-slate-700">สถานะ</th>
                  {/* Sticky Action Column so actions are always reachable */}
                  <th id="main-land-table-actions" className="py-3 px-3 text-center w-36 min-w-[145px] sticky right-0 bg-slate-800 border-b border-l border-slate-700 shadow-[-4px_0_10px_rgba(0,0,0,0.4)] z-30 action-buttons management-control">
                    จัดการ
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {filteredPlots.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="py-16 text-center text-slate-400 space-y-2">
                      <div className="text-slate-500 font-medium text-sm">
                        ไม่พบข้อมูลแปลงที่ดินที่ตรงกับเงื่อนไขการค้นหา
                      </div>
                      <p className="text-xs text-slate-500">
                        ลองเปลี่ยนคำค้นหา ปรับช่วงราคา หรือกด &quot;ล้างตัวกรองทั้งหมด&quot;
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold cursor-pointer border border-slate-700 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> ล้างตัวกรองทั้งหมด
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredPlots.map((plot) => {
                    const hasSubParcels = plot.subParcels && plot.subParcels.length > 0;
                    const isExpanded = expandedPlots[plot.id];
                    const otherCosts = (plot.taxAndFees || 0) + (plot.surveyCost || 0) + (plot.otherExpenses || 0);

                    return (
                      <React.Fragment key={plot.id}>
                        {/* Parent Row */}
                        <tr
                          onClick={() => onSelectPlot(plot)}
                          className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedPlotIds.includes(plot.id)}
                              onChange={(e) => toggleSelectPlot(plot.id, e as any)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                              title="เลือกแปลงนี้เพื่อเปรียบเทียบ"
                            />
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-400">
                            {hasSubParcels ? (
                              <button
                                onClick={(e) => toggleExpand(plot.id, e)}
                                className="p-1 hover:text-emerald-400 rounded transition-colors inline-flex items-center justify-center cursor-pointer"
                                title="แสดง/ซ่อน โฉนดย่อย"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              plot.orderNumber
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-mono">{plot.purchaseDate || '-'}</td>
                          <td className="py-3 px-3 text-slate-400 font-mono">
                            {plot.saleDate ? (
                              <span className="text-rose-400 font-medium">{plot.saleDate}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{plot.title}</span>
                                {plot.images && plot.images.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-teal-400 border border-teal-500/30 shrink-0">
                                    <ImageIcon className="w-2.5 h-2.5" /> {plot.images.length}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditPlot(plot);
                                }}
                                className="px-1.5 py-0.5 rounded bg-blue-500/15 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-xs"
                                title={`คลิกเพื่อแก้ไขข้อมูลแปลง #${plot.orderNumber}: ${plot.title}`}
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>แก้ไข</span>
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              ประเภท: <span className="text-slate-300">{plot.landType}</span>
                              {plot.notes && (
                                <span className="text-slate-500 ml-1 truncate max-w-[200px] inline-block align-bottom">
                                  • {plot.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            <div>{plot.subdistrict}, {plot.district}</div>
                            <div className="text-[11px] text-slate-400">{plot.province}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-200">
                            {plot.primaryDeedNumber || '-'}
                            {hasSubParcels && (
                              <span className="ml-1 text-[10px] text-emerald-400">
                                (+{plot.subParcels?.length} โฉนด)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {plot.mapsUrl ? (
                              <a
                                href={plot.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] border border-slate-700 transition-colors"
                                title="เปิด Google Maps ดูตำแหน่งจริง"
                              >
                                <MapPin className="w-3 h-3 text-rose-400" />
                                แผนที่
                              </a>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-200">
                            <div>{formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}</div>
                            {plot.partiallySoldTotalSqWah && plot.partiallySoldTotalSqWah > 0 ? (
                              <div className="text-[10px] text-amber-400 font-sans">
                                ขาย: {formatThaiArea(plot.partiallySoldRai || 0, plot.partiallySoldNgan || 0, plot.partiallySoldSqWah || 0)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            <div>{Number(plot.totalSqWah ?? 0).toLocaleString('th-TH')}</div>
                            {plot.remainingSqWah !== undefined && plot.remainingSqWah !== null && plot.partiallySoldTotalSqWah && plot.partiallySoldTotalSqWah > 0 && (
                              <div className="text-[10px] text-emerald-400 font-sans font-semibold">
                                เหลือ {Number(plot.remainingSqWah).toLocaleString('th-TH')} ตร.ว.
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-200">
                            {formatCurrency(plot.purchasePrice)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">
                            {otherCosts > 0 ? formatCurrency(otherCosts) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white bg-slate-800/40">
                            {formatCurrency(plot.totalCost)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs">
                            {(() => {
                              const tax = getPlotLandTax(plot);
                              const config = TAX_USAGE_CONFIGS[tax.usageType];
                              return (
                                <div>
                                  <span className={tax.annualTax > 0 ? "font-semibold text-rose-300" : "text-emerald-400 font-medium"}>
                                    {formatCurrency(tax.annualTax)}
                                  </span>
                                  <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                                    <span>{config?.shortLabel || tax.usageType}</span>
                                    <span>•</span>
                                    <span>{tax.effectiveRatePercent.toFixed(2)}%</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                            {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
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
                          {/* Sticky Action TD so user always has access to Edit / Delete / View */}
                          <td className="py-2.5 px-3 text-center sticky right-0 bg-slate-900/98 backdrop-blur-md border-b border-l border-slate-700/80 shadow-[-4px_0_12px_rgba(0,0,0,0.5)] z-20 action-buttons management-control" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectPlot(plot);
                                }}
                                title="ดูรายละเอียดแปลงนี้"
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handlePrintSinglePlot(plot, e)}
                                title="พิมพ์ / ดู PDF แปลงนี้"
                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditPlot(plot);
                                }}
                                title="แก้ไขข้อมูลแปลงนี้ (เปิดฟอร์มแก้ไข)"
                                className="px-2 py-1 bg-blue-600/25 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 rounded-lg transition-all font-semibold text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>แก้ไข</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDuplicatePlot(plot);
                                }}
                                title="ทำซ้ำแปลงนี้"
                                className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlotToDelete(plot);
                                }}
                                title="ลบแปลงที่ดินนี้ (และอัปเดต Google Sheet)"
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Sub-parcels Nested Rows (if expanded) */}
                        {hasSubParcels && isExpanded && (
                          plot.subParcels!.map((sp, idx) => (
                            <tr
                              key={sp.id}
                              className="bg-slate-950/60 text-slate-400 border-l-2 border-emerald-500/50"
                            >
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-3 text-center text-[10px] font-mono text-slate-500">
                                └ {plot.orderNumber}.{idx + 1}
                              </td>
                              <td className="py-2 px-3"></td>
                              <td className="py-2 px-3"></td>
                              <td className="py-2 px-4 pl-8 text-[11px] text-slate-300">
                                โฉนดย่อย: {sp.notes || `แปลงย่อยที่ ${idx + 1}`}
                              </td>
                              <td className="py-2 px-3 text-[11px]">
                                {plot.subdistrict}, {plot.district}
                              </td>
                              <td className="py-2 px-3 font-mono text-emerald-400 font-semibold">
                                {sp.deedNumber}
                              </td>
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                {sp.mapsUrl ? (
                                  <a
                                    href={sp.mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" /> แผนที่
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-300 text-[11px]">
                                {formatThaiArea(sp.rai, sp.ngan, sp.sqWah)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-400 text-[11px]">
                                {sp.totalSqWah}
                              </td>
                              <td colSpan={6} className="py-2 px-3 text-slate-600 text-[10px] italic">
                                (นับรวมในแปลงแม่ #{plot.orderNumber})
                              </td>
                              <td className="py-2 px-3 text-center sticky right-0 bg-slate-950/95 backdrop-blur-sm border-l border-slate-800/80 shadow-[-4px_0_8px_rgba(0,0,0,0.3)] z-10" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditPlot(plot);
                                  }}
                                  className="px-2 py-0.5 rounded bg-blue-500/15 hover:bg-blue-600 text-blue-300 hover:text-white text-[10px] font-medium border border-blue-500/30 inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title={`แก้ไขข้อมูลแปลงแม่ #${plot.orderNumber} (รวมโฉนดย่อย)`}
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  <span>แก้ไข</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Table Summary Footer */}
              <tfoot className="bg-slate-800/90 font-semibold text-slate-200 border-t-2 border-slate-700">
                <tr>
                  <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                    รวมทั้งหมดที่เลือก ({filteredPlots.length} แปลง):
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-100">
                    {(totalSqWahFiltered / 400).toFixed(2)} ไร่
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400">
                    {totalSqWahFiltered.toLocaleString('th-TH')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-100">
                    {formatCurrency(totalPurchaseFiltered)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {formatCurrency(totalTaxFiltered + totalSurveyFiltered + totalOtherFiltered)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm font-bold bg-slate-800">
                    {formatCurrency(totalCostFiltered)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-300 font-bold">
                    {formatCurrency(totalLandTaxFiltered)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-300">
                    {formatCurrency(totalTargetSaleFiltered)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[11px] text-slate-400">{filteredPlots.length} แปลง</span>
                  </td>
                  <td className="py-3 px-3 text-center sticky right-0 bg-slate-800 border-l border-slate-700 shadow-[-4px_0_8px_rgba(0,0,0,0.3)] z-20">
                    <span className="text-[11px] text-emerald-400 font-mono">100%</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (Safe for iFrames & No browser popups) */}
      {plotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  ยืนยันการลบแปลงที่ดิน #{plotToDelete.orderNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลแปลงนี้ออกจากระบบ?
                </p>
              </div>
            </div>

            {/* Plot Details Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">ชื่อแปลง:</span>
                <span className="font-semibold text-slate-100">{plotToDelete.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ที่ตั้ง:</span>
                <span className="text-slate-300">
                  {plotToDelete.subdistrict}, {plotToDelete.district}, {plotToDelete.province}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">เลขโฉนด:</span>
                <span className="font-mono text-emerald-400 font-semibold">{plotToDelete.primaryDeedNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">เนื้อที่:</span>
                <span className="font-mono text-slate-200">
                  {formatThaiArea(plotToDelete.rai, plotToDelete.ngan, plotToDelete.sqWah)} ({plotToDelete.totalSqWah} ตร.ว.)
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-bold">
                <span className="text-slate-300">ต้นทุนรวม:</span>
                <span className="font-mono text-emerald-400">{formatCurrency(plotToDelete.totalCost)}</span>
              </div>
            </div>

            {/* Google Sheets Sync Notice */}
            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isGoogleAuthed 
                  ? 'ระบบจะอัปเดตและลบรายการนี้ออกจาก Google Sheet ให้โดยอัตโนมัติ'
                  : 'รายการนี้จะถูกลบออกจากฐานข้อมูลเครื่อง'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPlotToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = plotToDelete.id;
                  setPlotToDelete(null);
                  setSelectedPlotIds((prev) => prev.filter((pId) => pId !== id));
                  setExpandedPlots((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  });
                  onDeletePlot(id);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ยืนยันลบแปลงนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Comparison Action Bar */}
      {selectedPlotIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-cyan-500/50 shadow-2xl shadow-cyan-950/80 flex items-center gap-4 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-200">
              เลือกแล้ว <strong className="text-white font-mono text-sm">{selectedPlotIds.length}</strong> แปลง
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPrintScope('selected');
                setIsPrintModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
              title="พิมพ์หรือเปิดดู PDF สำหรับแปลงที่เลือกนี้"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ / PDF แปลงที่เลือก ({selectedPlotIds.length})</span>
            </button>

            <button
              onClick={() => setIsComparisonOpen(true)}
              disabled={selectedPlotIds.length < 2}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md ${
                selectedPlotIds.length >= 2
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title={selectedPlotIds.length < 2 ? 'โปรดเลือกอย่างน้อย 2 แปลงเพื่อเปรียบเทียบ' : 'เปิดมุมมองเปรียบเทียบเคียงข้างกัน'}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>เปรียบเทียบแปลงที่ดิน {selectedPlotIds.length >= 2 ? `(${selectedPlotIds.length} แปลง)` : '(เลือก 2 แปลงขึ้นไป)'}</span>
            </button>

            <button
              onClick={() => setSelectedPlotIds([])}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              ล้างที่เลือก
            </button>
          </div>
        </div>
      )}

      {/* Side-by-side Land Comparison Modal */}
      <LandComparisonModal
        plots={plots.filter((p) => selectedPlotIds.includes(p.id))}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        onSelectPlot={onSelectPlot}
      />

      {/* Print Report Preview & Configuration Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5 animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    พิมพ์รายงาน & ส่งออก PDF บัญชีแปลงที่ดิน
                  </h3>
                  <p className="text-xs text-slate-400">
                    จัดหน้ากระดาษ A4 สวยงาม ข้อมูลสมดุล ตัวเลขครบถ้วน ไม่ตกขอบ
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
                        ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                        <span>แนวนอน (A4 Landscape)</span>
                      </div>
                      {printOrientation === 'landscape' && (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                        🌟 แนะนำมากที่สุด
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                       ตารางบัญชี 11 คอลัมน์กว้างสบาย พอดีหน้ากระดาษ ไม่เบียด
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      printOrientation === 'portrait'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-xs sm:text-sm">
                        แนวตั้ง (A4 Portrait)
                      </div>
                      {printOrientation === 'portrait' && (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-semibold">
                        มาตรฐาน
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      สำหรับพิมพ์เอกสารทางการแนวตั้งเข้าแฟ้ม
                    </p>
                  </button>
                </div>
              </div>

              {/* Scope Selector (Selected Plots vs Filtered vs All) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  เลือกขอบเขตข้อมูลที่ต้องการพิมพ์:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Option 1: Selected Plots */}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPlotIds.length > 0) {
                        setPrintScope('selected');
                      }
                    }}
                    disabled={selectedPlotIds.length === 0}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      printScope === 'selected'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold ring-1 ring-emerald-500/30'
                        : selectedPlotIds.length === 0
                        ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white">เฉพาะที่เลือก</div>
                      {selectedPlotIds.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                          {selectedPlotIds.length} แปลง
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-cyan-400 font-mono mt-0.5 font-bold">
                      {selectedPlotIds.length > 0
                        ? `${selectedPlotIds.length} แปลงที่เลือกไว้`
                        : '(ยังไม่ได้เลือกแปลง)'}
                    </div>
                  </button>

                  {/* Option 2: Filtered Plots */}
                  <button
                    type="button"
                    onClick={() => setPrintScope('filtered')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'filtered'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-white">แปลงที่กรองอยู่</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5 font-bold">
                      {filteredPlots.length} แปลง (ตามตัวกรอง)
                    </div>
                  </button>

                  {/* Option 3: All Plots */}
                  <button
                    type="button"
                    onClick={() => setPrintScope('all')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printScope === 'all'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold ring-1 ring-emerald-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-semibold text-white">แปลงทั้งหมด</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5 font-bold">
                      {plots.length} แปลง (ทั้งพอร์ต)
                    </div>
                  </button>
                </div>
              </div>

              {/* Preview Stats summary */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">แปลงที่จะรายงาน</span>
                    <span className="font-bold text-white font-mono text-xs">{printTotals.totalPlots} แปลง</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">เนื้อที่รวม</span>
                    <span className="font-bold text-white font-mono text-[11px]">{formatThaiArea(printTotals.totalSqWah)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">ต้นทุนรวมทั้งสิ้น</span>
                    <span className="font-bold text-emerald-400 font-mono text-[11px]">{formatCurrency(printTotals.totalCost)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">ภาษีที่ดิน/ปี</span>
                    <span className="font-bold text-rose-400 font-mono text-[11px]">{formatCurrency(printTotals.totalAnnualLandTax)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Open PDF in New Tab, Download PDF, and Print Dialog */}
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
                  title="เปิดเอกสารรายงาน PDF คุณภาพสูงในแท็บใหม่"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-sky-400" />
                  )}
                  <span>เปิดดูเป็น PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleExportPdf('download')}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="ดาวน์โหลดไฟล์ PDF เข้าเครื่องโดยตรง"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Download className="w-4 h-4 text-white" />
                  )}
                  <span>ดาวน์โหลด PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handlePrint}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="เปิดหน้าต่างสั่งพิมพ์ของบราวเซอร์เพื่อส่งออกเครื่องพิมพ์หรือ Save as PDF"
                >
                  <Printer className="w-4 h-4 text-slate-300" />
                  <span>สั่งพิมพ์ (Print)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div> {/* Close Interactive Controls & Tables (print:hidden) */}

      {/* Hidden container for print media & PDF export (Expanded to immaculate A4 layout in print and off-screen canvas) */}
      <div 
        ref={printReportRef}
        id="printable-land-table-report" 
        className="hidden print:block p-6 sm:p-8 bg-white text-black font-sans w-full max-w-full box-border"
      >
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold tracking-wider uppercase">
                EXECUTIVE LEDGER
              </span>
              <h1 className="text-xl font-extrabold text-black tracking-tight">
                {settings?.portfolioTitle || 'รายงานบัญชีแปลงที่ดินและการเงิน'}
              </h1>
            </div>
            <p className="text-[11px] text-slate-700">
              เจ้าของพอร์ต: <span className="font-bold text-black">{settings?.ownerName || 'ผู้ดูแลระบบ'}</span> • สกุลเงิน: <span className="font-semibold text-black">{settings?.currency || 'THB (บาท)'}</span> • เอกสารทางการเพื่อการบริหารจัดการและการตรวจสอบ
            </p>
          </div>
          <div className="text-right text-[10.5px] text-slate-700 space-y-1">
            <p className="font-bold text-slate-950 uppercase tracking-wide">
              {printOrientation === 'landscape' ? 'รูปแบบ: แนวนอน (A4 Landscape)' : 'รูปแบบ: แนวตั้ง (A4 Portrait)'}
            </p>
            <p>วันที่พิมพ์: <span className="font-semibold text-black">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</span></p>
            <p>ขอบเขตข้อมูล: <span className="font-semibold text-black">{
              printScope === 'selected'
                ? `เฉพาะแปลงที่เลือก (${printPlots.length} แปลง)`
                : printScope === 'all'
                ? `ทั้งหมด (${plots.length} แปลง)`
                : `กรองตามเงื่อนไข (${filteredPlots.length} แปลง)`
            }</span></p>
          </div>
        </div>

        {/* 5 Executive KPI Summary Cards */}
        <div className="grid grid-cols-5 gap-2.5 mb-4">
          <div className="p-2.5 border border-slate-300 rounded-lg bg-slate-50/80 shadow-xs">
            <span className="text-[9.5px] font-semibold text-slate-600 block uppercase">จำนวนแปลงที่ดิน</span>
            <span className="text-base font-extrabold text-black font-mono">{printTotals.totalPlots} <span className="text-xs font-normal text-slate-700">แปลง</span></span>
          </div>
          <div className="p-2.5 border border-slate-300 rounded-lg bg-slate-50/80 shadow-xs">
            <span className="text-[9.5px] font-semibold text-slate-600 block uppercase">เนื้อที่ดินรวมทั้งหมด</span>
            <span className="text-sm font-bold text-black font-mono leading-tight block">{formatThaiArea(printTotals.totalSqWah)}</span>
          </div>
          <div className="p-2.5 border border-slate-300 rounded-lg bg-slate-50/80 shadow-xs">
            <span className="text-[9.5px] font-semibold text-slate-600 block uppercase">ต้นทุนรวมสุทธิทั้งสิ้น</span>
            <span className="text-base font-extrabold text-black font-mono">{formatCurrency(printTotals.totalCost)}</span>
          </div>
          <div className="p-2.5 border border-slate-300 rounded-lg bg-slate-50/80 shadow-xs">
            <span className="text-[9.5px] font-semibold text-slate-600 block uppercase">ภาษีที่ดิน/ปี รวม</span>
            <span className="text-base font-extrabold text-rose-800 font-mono">{formatCurrency(printTotals.totalAnnualLandTax)}</span>
          </div>
          <div className="p-2.5 border border-slate-300 rounded-lg bg-slate-50/80 shadow-xs">
            <span className="text-[9.5px] font-semibold text-slate-600 block uppercase">มูลค่าเป้าหมาย/ยอดขาย</span>
            <span className="text-base font-extrabold text-black font-mono">{formatCurrency(printTotals.totalTargetOrSold)}</span>
          </div>
        </div>

        {/* Financial Table - Fixed 100% table layout for perfect balance without clipping */}
        <table className="w-full border-collapse border border-slate-300 text-[9.5px] leading-tight table-fixed">
          <thead>
            <tr className="bg-slate-100 text-black border-b-2 border-slate-400">
              <th style={{ width: '3.5%' }} className="py-2 px-1 border border-slate-300 text-center font-bold">#</th>
              <th style={{ width: '19%' }} className="py-2 px-2 border border-slate-300 text-left font-bold">แปลงที่ดิน / เลขโฉนด</th>
              <th style={{ width: '13.5%' }} className="py-2 px-1.5 border border-slate-300 text-left font-bold">ทำเล (ตำบล/อำเภอ/จังหวัด)</th>
              <th style={{ width: '7%' }} className="py-2 px-1.5 border border-slate-300 text-center font-bold">ประเภท</th>
              <th style={{ width: '9.5%' }} className="py-2 px-1.5 border border-slate-300 text-right font-mono font-bold">เนื้อที่</th>
              <th style={{ width: '9.5%' }} className="py-2 px-1.5 border border-slate-300 text-right font-mono font-bold whitespace-nowrap">ราคาซื้อ (บาท)</th>
              <th style={{ width: '7.5%' }} className="py-2 px-1.5 border border-slate-300 text-right font-mono font-bold whitespace-nowrap">ค่าใช้จ่ายอื่น</th>
              <th style={{ width: '10.5%' }} className="py-2 px-1.5 border border-slate-300 text-right font-mono font-bold whitespace-nowrap">ต้นทุนรวมสุทธิ</th>
              <th style={{ width: '6.5%' }} className="py-2 px-1.5 border border-slate-300 text-right font-mono font-bold whitespace-nowrap">ภาษี/ปี</th>
              <th style={{ width: '9%' }} className="py-2 px-1.5 border border-slate-300 text-right font-mono font-bold whitespace-nowrap">เป้า/ขายจริง</th>
              <th style={{ width: '4.5%' }} className="py-2 px-1 border border-slate-300 text-center font-bold">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {printPlots.map((plot, idx) => {
              const otherCost = (Number(plot.taxAndFees) || 0) + (Number(plot.surveyCost) || 0) + (Number(plot.otherExpenses) || 0);
              const targetOrSold = plot.status === 'sold' ? (Number(plot.soldPrice) || 0) : (Number(plot.targetSalePrice) || 0);
              const tax = getPlotLandTax(plot);
              return (
                <tr key={plot.id} className="border-b border-slate-200 even:bg-slate-50/70 hover:bg-slate-100/50">
                  <td className="py-1.5 px-1 border border-slate-300 text-center font-mono font-bold text-slate-800">
                    {plot.orderNumber || idx + 1}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 overflow-hidden text-ellipsis">
                    <div className="font-bold text-black truncate">{plot.title}</div>
                    {plot.primaryDeedNumber && (
                      <div className="text-[9px] text-slate-600 font-mono">โฉนด: {plot.primaryDeedNumber}</div>
                    )}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-slate-800 text-[9px] overflow-hidden text-ellipsis">
                    {plot.subdistrict || '-'}, {plot.district || '-'}, {plot.province || '-'}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-center text-[9px]">
                    {plot.landType || '-'}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-right font-mono whitespace-nowrap">
                    {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-right font-mono whitespace-nowrap">
                    {formatCurrency(plot.purchasePrice)}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-right font-mono text-slate-700 whitespace-nowrap">
                    {formatCurrency(otherCost)}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-right font-mono font-bold text-black whitespace-nowrap">
                    {formatCurrency(plot.totalCost)}
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-right font-mono whitespace-nowrap">
                    <span className={tax.annualTax > 0 ? "font-bold text-rose-800" : "text-emerald-800"}>
                      {formatCurrency(tax.annualTax)}
                    </span>
                  </td>
                  <td className="py-1.5 px-1.5 border border-slate-300 text-right font-mono font-bold text-black whitespace-nowrap">
                    {formatCurrency(targetOrSold)}
                  </td>
                  <td className="py-1.5 px-1 border border-slate-300 text-center font-bold text-[9px] whitespace-nowrap">
                    {plot.status === 'holding' && <span className="text-emerald-900">ถือครอง</span>}
                    {plot.status === 'for_sale' && <span className="text-blue-900">ประกาศขาย</span>}
                    {plot.status === 'consignment' && <span className="text-amber-900">ขายฝาก</span>}
                    {plot.status === 'sold' && <span className="text-rose-900">ขายแล้ว</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-extrabold border-t-2 border-b-2 border-slate-900">
              <td colSpan={4} className="py-2.5 px-2 border border-slate-300 text-center font-bold text-black">
                รวมทั้งสิ้น ({printTotals.totalPlots} แปลง)
              </td>
              <td className="py-2.5 px-1.5 border border-slate-300 text-right font-mono whitespace-nowrap text-black font-bold">
                {formatThaiArea(printTotals.totalSqWah)}
              </td>
              <td className="py-2.5 px-1.5 border border-slate-300 text-right font-mono whitespace-nowrap text-black font-bold">
                {formatCurrency(printTotals.totalPurchase)}
              </td>
              <td className="py-2.5 px-1.5 border border-slate-300 text-right font-mono whitespace-nowrap text-slate-800 font-bold">
                {formatCurrency(printTotals.totalFees)}
              </td>
              <td className="py-2.5 px-1.5 border border-slate-300 text-right font-mono text-black font-extrabold whitespace-nowrap">
                {formatCurrency(printTotals.totalCost)}
              </td>
              <td className="py-2.5 px-1.5 border border-slate-300 text-right font-mono font-extrabold text-rose-900 whitespace-nowrap">
                {formatCurrency(printTotals.totalAnnualLandTax)}
              </td>
              <td className="py-2.5 px-1.5 border border-slate-300 text-right font-mono text-black font-extrabold whitespace-nowrap">
                {formatCurrency(printTotals.totalTargetOrSold)}
              </td>
              <td className="py-2.5 px-1 border border-slate-300 text-center font-bold text-black">-</td>
            </tr>
          </tfoot>
        </table>

        {/* Signature & Verification Block */}
        <div className="mt-10 grid grid-cols-2 gap-12 pt-6 border-t border-slate-300 text-xs">
          <div className="text-center space-y-9">
            <p className="font-bold text-slate-900">ผู้จัดทำรายงาน (Prepared By)</p>
            <div className="border-b border-slate-400 w-52 mx-auto"></div>
            <p className="text-slate-600 text-[11px]">วันที่: ..... / ..... / ..........</p>
          </div>
          <div className="text-center space-y-9">
            <p className="font-bold text-slate-900">ผู้ตรวจสอบ / เจ้าของพอร์ต (Approved By)</p>
            <div className="border-b border-slate-400 w-52 mx-auto"></div>
            <p className="text-slate-600 text-[11px]">วันที่: ..... / ..... / ..........</p>
          </div>
        </div>
      </div>

      {/* Toast Notification for PDF Generation / Export */}
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

