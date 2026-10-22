import React from 'react';
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
  BadgePercent
} from 'lucide-react';
import { LandPlot, KPIStats, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';

interface KPIDashboardProps {
  plots: LandPlot[];
  kpis: KPIStats;
  settings: PortfolioSettings;
  onNavigateToSimulator: () => void;
  onNavigateToTable: () => void;
  onSelectPlot: (plot: LandPlot) => void;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  plots,
  kpis,
  settings,
  onNavigateToSimulator,
  onNavigateToTable,
  onSelectPlot,
}) => {
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

        <div className="flex items-center gap-3 relative z-10">
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
