import React, { useState, useMemo, useEffect } from 'react';
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
  Timer
} from 'lucide-react';
import { LandPlot, KPIStats, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea, calculatePlotHoldingInfo, HoldingPeriodInfo } from '../services/storage';

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
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ========================================================================= */}
      {/* HOLDING PERIOD ALERT SYSTEM: Identify & Notify Plots Exceeding Target Time */}
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
            <span className="text-xs text-slate-400">มูลค่าต้นทุน</span>
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
            <span className="text-xs text-slate-400">จำนวนแปลง</span>
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
            <span className="text-xs text-slate-400">
              รวม: {formatCurrency(kpis.totalAcquisitionCost)}
            </span>
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
          <button
            onClick={onNavigateToTable}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            ดูทั้งหมด ({plots.length} รายการ) <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
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
    </div>
  );
};
