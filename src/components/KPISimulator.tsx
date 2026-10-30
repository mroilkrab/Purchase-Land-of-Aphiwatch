import React, { useState } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Sliders, 
  Percent, 
  Coins, 
  Building, 
  Check, 
  Sparkles, 
  ArrowRight,
  Info,
  Receipt,
  Scale,
  Printer
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';
import { getPlotLandTax, TAX_USAGE_CONFIGS } from '../services/landTax';
import { triggerPrint } from '../utils/print';

interface KPISimulatorProps {
  plots: LandPlot[];
  settings: PortfolioSettings;
  onUpdatePlot: (updatedPlot: LandPlot) => void;
}

export const KPISimulator: React.FC<KPISimulatorProps> = ({
  plots,
  settings,
  onUpdatePlot,
}) => {
  const activePlots = plots.filter((p) => p.status !== 'sold');
  const [selectedPlotId, setSelectedPlotId] = useState<string>(activePlots[0]?.id || plots[0]?.id || '');
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(35); // 35% margin
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionRate || 3);
  const [taxRate, setTaxRate] = useState<number>(settings.defaultTaxRate || 2);
  const [includeLandTax, setIncludeLandTax] = useState<boolean>(true);
  const [holdingPeriodMonths, setHoldingPeriodMonths] = useState<number>(settings.expectedHoldingPeriodMonths || 12);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const selectedPlot = plots.find((p) => p.id === selectedPlotId) || activePlots[0] || plots[0];

  // Land and Building Tax calculation
  const plotLandTax = selectedPlot ? getPlotLandTax(selectedPlot, holdingPeriodMonths) : null;
  const accruedLandTax = (includeLandTax && plotLandTax) ? plotLandTax.accruedTaxForPeriod : 0;

  // Simulator calculations
  const totalCost = selectedPlot?.totalCost || 0;
  const totalSqWah = selectedPlot?.totalSqWah || 1;
  const totalRai = totalSqWah / 400;

  // Selling price before deducting sales fees: cost * (1 + margin / 100)
  const simulatedSellingPrice = Math.round(totalCost * (1 + targetMarginPercent / 100));
  const estimatedCommission = Math.round(simulatedSellingPrice * (commissionRate / 100));
  const estimatedTax = Math.round(simulatedSellingPrice * (taxRate / 100));
  const netProceeds = simulatedSellingPrice - estimatedCommission - estimatedTax - accruedLandTax;
  const netProfit = netProceeds - totalCost;
  const netROI = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  const pricePerSqWah = totalSqWah > 0 ? Math.round(simulatedSellingPrice / totalSqWah) : 0;
  const pricePerRai = totalRai > 0 ? Math.round(simulatedSellingPrice / totalRai) : 0;

  const handleApplyToPlot = () => {
    if (!selectedPlot) return;
    const updated: LandPlot = {
      ...selectedPlot,
      targetSalePrice: simulatedSellingPrice,
      commissionFee: estimatedCommission,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-xl print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <Calculator className="w-3.5 h-3.5" /> KPI & Profit Margin Simulator
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              แบบจำลองประมาณการราคาขายและคำนวณกำไรสุทธิ
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              ปรับอัตราผลตอบแทนเป้าหมาย คำนวณหักค่าคอมมิชชั่นและค่าธรรมเนียมโอน พร้อมบันทึกเป็นราคาตั้งใจขาย (Target KPI)
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => triggerPrint('portrait')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              title="พิมพ์รายงานแบบจำลองประมาณการกำไร (A4 PDF / Print)"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Left Controls: Select Plot & Sliders */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-400" />
              1. เลือกแปลงที่ดินที่จะประมาณการ
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium">แปลงที่ดิน (ลำดับ / ชื่อแปลง):</label>
              <select
                value={selectedPlotId}
                onChange={(e) => setSelectedPlotId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.orderNumber} - {p.title} ({p.subdistrict}, {p.province}) [{formatCurrency(p.totalCost)}]
                  </option>
                ))}
              </select>
            </div>

            {selectedPlot && (
              <div className="p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">เลขที่ดิน:</span>
                  <span className="font-mono text-slate-200">{selectedPlot.primaryDeedNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">เนื้อที่รวม:</span>
                  <span className="text-slate-200">
                    {formatThaiArea(selectedPlot.rai, selectedPlot.ngan, selectedPlot.sqWah)} ({selectedPlot.totalSqWah} ตร.ว.)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ต้นทุนซื้อรวมทั้งสิ้น:</span>
                  <span className="font-mono font-semibold text-blue-400">
                    {formatCurrency(selectedPlot.totalCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ราคาตั้งใจขายเดิมในระบบ:</span>
                  <span className="font-mono text-emerald-400">
                    {selectedPlot.targetSalePrice > 0 ? formatCurrency(selectedPlot.targetSalePrice) : 'ยังไม่ระบุ'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sliders Box */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              2. ปรับแต่งตัวแปรผลตอบแทน (Simulation Parameters)
            </h3>

            {/* Margin Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  อัตรากำไรเป้าหมาย (Target Gross Margin):
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  +{targetMarginPercent}%
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                step="5"
                value={targetMarginPercent}
                onChange={(e) => setTargetMarginPercent(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>+5%</span>
                <span>+25%</span>
                <span>+50%</span>
                <span>+100%</span>
                <span>+150%</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {[20, 30, 40, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTargetMarginPercent(preset)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                    targetMarginPercent === preset
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  +{preset}%
                </button>
              ))}
            </div>

            {/* Commission Rate Slider */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  หักค่าคอมมิชชั่นนายหน้า:
                </span>
                <span className="font-mono font-semibold text-amber-400 text-sm">
                  {commissionRate}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (ขายเอง)</span>
                <span>3% (มาตรฐาน)</span>
                <span>5%</span>
              </div>
            </div>

            {/* Estimated Tax & Fees Rate Slider */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-blue-400" />
                  ประมาณการภาษี/ค่าโอน (ฝั่งผู้ขาย):
                </span>
                <span className="font-mono font-semibold text-blue-400 text-sm">
                  {taxRate}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (ผู้ซื้อจ่าย)</span>
                <span>2% (คนละครึ่ง)</span>
                <span>4%</span>
              </div>
            </div>

            {/* Land and Building Tax Act B.E. 2562 Holding Cost Control */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-rose-400" />
                  ภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. 2562):
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={includeLandTax}
                    onChange={(e) => setIncludeLandTax(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 bg-slate-800 border-slate-700"
                  />
                  <span className="text-slate-300 font-medium">คำนวณหักในกำไร</span>
                </label>
              </div>

              {plotLandTax && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-rose-500/20 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">ประเภทการใช้ประโยชน์:</span>
                    <span className="font-semibold text-slate-200">
                      {TAX_USAGE_CONFIGS[plotLandTax.usageType].shortLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">ภาษีประเมินต่อปี:</span>
                    <span className="font-mono font-bold text-rose-300">
                      {plotLandTax.annualTax === 0 ? '0 ฿ (ยกเว้น 50 ล้านแรก)' : `${formatCurrency(plotLandTax.annualTax)} / ปี`}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">ระยะเวลาถือครองจำลอง:</span>
                      <span className="font-mono text-emerald-400 font-semibold">{holdingPeriodMonths} เดือน</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 pt-1">
                      {[6, 12, 18, 24, 36].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setHoldingPeriodMonths(m)}
                          className={`py-1 rounded text-center text-[10px] font-mono transition-colors cursor-pointer ${
                            holdingPeriodMonths === m
                              ? 'bg-rose-500 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m} ด.
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400">
                      <span>ภาษีที่ดินสะสมตามระยะถือครอง:</span>
                      <span className="font-mono font-bold text-rose-300">
                        {formatCurrency(plotLandTax.accruedTaxForPeriod)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Output: Simulated KPI Cards & Save Action */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  ผลลัพธ์การจำลองราคา (Projected Output)
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  ราคาขายแนะนำและผลตอบแทนสุทธิ
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                กำไรคาดหวัง +{targetMarginPercent}%
              </span>
            </div>

            {/* Large Highlight Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 text-center relative overflow-hidden">
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
                ราคาที่ควรตั้งขาย (Recommended Target Selling Price)
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2 font-mono">
                {formatCurrency(simulatedSellingPrice)}
              </div>

              {/* Price per unit breakdown */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-500/20">
                <div className="text-left bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">ราคาต่อตารางวา</div>
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {formatCurrency(pricePerSqWah)} / ตร.ว.
                  </div>
                </div>
                <div className="text-left bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">ราคาต่อไร่</div>
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {formatCurrency(pricePerRai)} / ไร่
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Waterfall Breakdown */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                สรุปแจกแจงค่าใช้จ่ายและกำไรสุทธิ (Financial Waterfall):
              </div>

              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60">
                <span className="text-slate-300">ราคาขายรวมที่ตั้งไว้:</span>
                <span className="font-mono font-medium text-white">{formatCurrency(simulatedSellingPrice)}</span>
              </div>

              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 text-rose-400">
                <span>หัก ค่าคอมมิชชั่นนายหน้า ({commissionRate}%):</span>
                <span className="font-mono font-medium">-{formatCurrency(estimatedCommission)}</span>
              </div>

              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 text-amber-400">
                <span>หัก ประมาณการค่าภาษี/ค่าโอน ({taxRate}%):</span>
                <span className="font-mono font-medium">-{formatCurrency(estimatedTax)}</span>
              </div>

              {includeLandTax && accruedLandTax > 0 && (
                <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 text-rose-300">
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-rose-400" />
                    หัก ภาษีที่ดินและสิ่งปลูกสร้างสะสม ({holdingPeriodMonths} เดือน):
                  </span>
                  <span className="font-mono font-medium">-{formatCurrency(accruedLandTax)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 text-slate-300">
                <span>ยอดเงินสุทธิที่ได้รับหลังหักค่าใช้จ่าย:</span>
                <span className="font-mono font-bold text-white">{formatCurrency(netProceeds)}</span>
              </div>

              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60 text-slate-400">
                <span>หัก ต้นทุนรวมซื้อทั้งสิ้น:</span>
                <span className="font-mono font-medium">-{formatCurrency(totalCost)}</span>
              </div>

              <div className="flex justify-between items-center text-sm py-2 bg-emerald-500/10 px-3 rounded-lg border border-emerald-500/20 font-bold">
                <span className="text-emerald-400">กำไรสุทธิคาดการณ์ (Net Profit):</span>
                <span className="font-mono text-emerald-300 text-base">+{formatCurrency(netProfit)}</span>
              </div>

              <div className="flex justify-between items-center text-xs px-3 text-slate-400">
                <span>อัตราผลตอบแทนสุทธิจริง (Net ROI %):</span>
                <span className="font-mono font-bold text-emerald-400">{netROI.toFixed(1)}%</span>
              </div>
            </div>

            {/* Save Button Action */}
            <div className="pt-2">
              <button
                onClick={handleApplyToPlot}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-5 h-5 text-white" />
                    บันทึกราคาขาย {formatCurrency(simulatedSellingPrice)} ลงในระบบแล้ว!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    บันทึกเป็นราคาตั้งใจขาย (Target KPI) ของแปลง #{selectedPlot?.orderNumber}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable KPI & Profit Simulation Report (A4 Format) */}
      <div id="printable-kpi-simulation" className="hidden print:block text-black bg-white p-6 max-w-full">
        {/* Document Header */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-gray-600 block">
                LAND PORTFOLIO & TRADING LEDGER SYSTEM
              </span>
              <h1 className="text-xl font-bold text-black mt-0.5">
                รายงานผลจำลองประมาณการราคาขายและผลตอบแทนการลงทุน (KPI Simulation Report)
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                การจำลองกลยุทธ์การตั้งราคาขาย หักค่าใช้จ่ายในการขาย และคำนวณกำไรสุทธิแท้จริง (Net Realized Profit)
              </p>
            </div>
            <div className="text-right text-xs text-gray-700">
              <div className="font-bold">วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div>เวลา: {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-mono">SIMULATION SCENARIO</div>
            </div>
          </div>
        </div>

        {selectedPlot ? (
          <>
            {/* Plot Details */}
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider bg-gray-100 p-1.5 border border-black mb-2 text-black">
                1. ข้อมูลแปลงที่ดินที่เลือกทำการจำลอง (Selected Land Plot)
              </h2>
              <table className="w-full text-xs border-collapse border border-black mb-2">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-2 font-bold bg-gray-50 border-r border-black w-36">ลำดับ / ชื่อแปลง:</td>
                    <td className="p-2 font-semibold">แปลง #{selectedPlot.orderNumber}: {selectedPlot.title}</td>
                    <td className="p-2 font-bold bg-gray-50 border-x border-black w-36">สถานะปัจจุบัน:</td>
                    <td className="p-2 font-semibold">
                      {selectedPlot.status === 'sold' ? 'ขายแล้ว' : selectedPlot.status === 'consignment' ? 'รับขายฝาก' : selectedPlot.status === 'for_sale' ? 'กำลังประกาศขาย' : 'ถือครอง'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-2 font-bold bg-gray-50 border-r border-black">ทำเลที่ตั้ง:</td>
                    <td className="p-2">ต.{selectedPlot.subdistrict} อ.{selectedPlot.district} จ.{selectedPlot.province}</td>
                    <td className="p-2 font-bold bg-gray-50 border-x border-black">ประเภทกรรมสิทธิ์:</td>
                    <td className="p-2">{selectedPlot.landType}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-2 font-bold bg-gray-50 border-r border-black">ขนาดเนื้อที่ดิน:</td>
                    <td className="p-2 font-semibold">
                      {formatThaiArea(selectedPlot.rai, selectedPlot.ngan, selectedPlot.sqWah)} ({selectedPlot.totalSqWah.toLocaleString('th-TH')} ตร.ว.)
                    </td>
                    <td className="p-2 font-bold bg-gray-50 border-x border-black">ต้นทุนซื้อรวมทั้งสิ้น:</td>
                    <td className="p-2 font-bold font-mono">{formatCurrency(selectedPlot.totalCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Simulation Parameters & Results */}
            <div className="mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider bg-gray-100 p-1.5 border border-black mb-2 text-black">
                2. ผลการจำลองการเงินและผลตอบแทนสุทธิ (Financial Simulation Breakdown)
              </h2>
              <table className="w-full text-xs border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-200 border-b border-black">
                    <th className="p-2 text-left font-bold border-r border-black">รายการวิเคราะห์ทางการเงิน</th>
                    <th className="p-2 text-right font-bold border-r border-black w-44">จำนวนเงิน / อัตรา</th>
                    <th className="p-2 text-left font-bold w-48">หมายเหตุประกอบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/30">
                  <tr>
                    <td className="p-2 font-medium border-r border-black">อัตรากำไรเป้าหมายที่ตั้งไว้ (Target Margin)</td>
                    <td className="p-2 text-right font-mono font-bold border-r border-black">+{targetMarginPercent}%</td>
                    <td className="p-2 text-gray-600 text-[11px]">การตั้งเป้าหมายส่วนต่างกำไรขั้นต้น</td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-2 border-r border-black">ราคาตั้งขายจำลอง (Gross Selling Price)</td>
                    <td className="p-2 text-right font-mono border-r border-black text-sm">{formatCurrency(simulatedSellingPrice)}</td>
                    <td className="p-2 text-gray-700 text-[11px] font-mono">
                      ~{pricePerSqWah.toLocaleString('th-TH')} บ./ตร.ว. ({pricePerRai.toLocaleString('th-TH')} บ./ไร่)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium border-r border-black text-rose-800">
                      หัก: ค่าคอมมิชชั่นนายหน้า ({commissionRate}%)
                    </td>
                    <td className="p-2 text-right font-mono text-rose-800 border-r border-black">
                      -{formatCurrency(estimatedCommission)}
                    </td>
                    <td className="p-2 text-gray-600 text-[11px]">ประมาณการค่าตอบแทนตัวแทนนายหน้า</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium border-r border-black text-rose-800">
                      หัก: ค่าธรรมเนียมการโอนและภาษีขาย (~{taxRate}%)
                    </td>
                    <td className="p-2 text-right font-mono text-rose-800 border-r border-black">
                      -{formatCurrency(estimatedTax)}
                    </td>
                    <td className="p-2 text-gray-600 text-[11px]">สัดส่วนภาระผู้ขายตามมาตรฐาน</td>
                  </tr>
                  {includeLandTax && accruedLandTax > 0 && (
                    <tr>
                      <td className="p-2 font-medium border-r border-black text-rose-800">
                        หัก: ภาษีที่ดินและสิ่งปลูกสร้างสะสม ({holdingPeriodMonths} เดือน)
                      </td>
                      <td className="p-2 text-right font-mono text-rose-800 border-r border-black">
                        -{formatCurrency(accruedLandTax)}
                      </td>
                      <td className="p-2 text-gray-600 text-[11px]">ภาระภาษีที่ดินประจำปีตาม พ.ร.บ.</td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 font-semibold border-t border-b border-black">
                    <td className="p-2 border-r border-black">เงินสดรับสุทธิหลังหักค่าใช้จ่ายการขาย (Net Proceeds)</td>
                    <td className="p-2 text-right font-mono border-r border-black font-bold">{formatCurrency(netProceeds)}</td>
                    <td className="p-2 text-gray-700 text-[11px]">กระแสเงินสดรับก่อนหักต้นทุนซื้อ</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium border-r border-black">
                      หัก: ต้นทุนซื้อและพัฒนาที่ดินทั้งหมด
                    </td>
                    <td className="p-2 text-right font-mono border-r border-black">
                      -{formatCurrency(selectedPlot.totalCost)}
                    </td>
                    <td className="p-2 text-gray-600 text-[11px]">ต้นทุนซื้อ + ค่าธรรมเนียม + รังวัด + พัฒนา</td>
                  </tr>
                  <tr className="bg-gray-200 font-bold border-t-2 border-b-2 border-black">
                    <td className="p-2.5 border-r border-black text-sm">กำไรสุทธิแท้จริง (Realized Net Profit)</td>
                    <td className={`p-2.5 text-right font-mono text-base border-r border-black ${netProfit >= 0 ? 'text-black' : 'text-rose-700'}`}>
                      {netProfit >= 0 ? `+${formatCurrency(netProfit)}` : formatCurrency(netProfit)}
                    </td>
                    <td className="p-2.5 text-xs font-bold">
                      {netProfit >= 0 ? 'กำไรตามเป้าหมาย' : 'ขาดทุน (ต่ำกว่าต้นทุน)'}
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-2 font-bold border-r border-black">อัตราผลตอบแทนสุทธิ (Actual Net ROI)</td>
                    <td className="p-2 text-right font-mono font-bold text-sm border-r border-black">
                      {netROI.toFixed(2)}%
                    </td>
                    <td className="p-2 text-gray-700 text-[11px]">
                      อัตราต่อปี (Annualized): ~{(holdingPeriodMonths > 0 ? (netROI / (holdingPeriodMonths / 12)).toFixed(2) : netROI.toFixed(2))}%/ปี (ระยะเวลา {holdingPeriodMonths} เดือน)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Assessment Note */}
            <div className="p-3 border border-gray-400 bg-gray-50 text-xs mb-6">
              <span className="font-bold text-black block mb-0.5">ข้อสรุปและการประเมินความเป็นไปได้:</span>
              <p className="text-gray-700 leading-relaxed">
                การตั้งราคาขายที่ {formatCurrency(simulatedSellingPrice)} สอดคล้องกับกลยุทธ์สร้างผลตอบแทนสุทธิ {netROI.toFixed(1)}% หลังหักค่าใช้จ่ายการขายทั้งหมดเรียบร้อยแล้ว ราคาเฉลี่ยต่อตารางวาอยู่ที่ {pricePerSqWah.toLocaleString('th-TH')} บาท ซึ่งเหมาะสมสำหรับนำไปตั้งเป็นราคาขายเป้าหมาย (Target KPI)
              </p>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-gray-500 text-xs">
            ไม่พบข้อมูลแปลงที่ดินที่เลือก
          </div>
        )}

        {/* Signatures */}
        <div className="pt-6 border-t border-gray-300 grid grid-cols-2 gap-8 text-center text-xs mt-6">
          <div>
            <div className="border-b border-black w-48 mx-auto mb-2 h-10"></div>
            <div className="font-bold">ผู้วิเคราะห์แบบจำลองทางการเงิน</div>
            <div className="text-gray-500 text-[10px]">วันที่: ....../....../......</div>
          </div>
          <div>
            <div className="border-b border-black w-48 mx-auto mb-2 h-10"></div>
            <div className="font-bold">ผู้อนุมัติราคาขายเป้าหมาย / กรรมการ</div>
            <div className="text-gray-500 text-[10px]">วันที่: ....../....../......</div>
          </div>
        </div>
      </div>
    </div>
  );
};
