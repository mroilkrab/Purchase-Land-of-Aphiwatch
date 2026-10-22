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
  Info
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';

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
  const [savedSuccess, setSavedSuccess] = useState(false);

  const selectedPlot = plots.find((p) => p.id === selectedPlotId) || activePlots[0] || plots[0];

  // Simulator calculations
  const totalCost = selectedPlot?.totalCost || 0;
  const totalSqWah = selectedPlot?.totalSqWah || 1;
  const totalRai = totalSqWah / 400;

  // Selling price before deducting sales fees: cost * (1 + margin / 100)
  const simulatedSellingPrice = Math.round(totalCost * (1 + targetMarginPercent / 100));
  const estimatedCommission = Math.round(simulatedSellingPrice * (commissionRate / 100));
  const estimatedTax = Math.round(simulatedSellingPrice * (taxRate / 100));
  const netProceeds = simulatedSellingPrice - estimatedCommission - estimatedTax;
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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-xl">
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
    </div>
  );
};
