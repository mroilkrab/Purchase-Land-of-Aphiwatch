import React, { useState } from 'react';
import { 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  Sparkles, 
  Building2, 
  ShieldCheck, 
  TrendingUp, 
  Wallet, 
  MapPin, 
  Calendar,
  Share2
} from 'lucide-react';
import { LandPlot, KPIStats, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';
import { triggerPrint } from '../utils/print';

interface LiveArtifactViewProps {
  plots: LandPlot[];
  kpis: KPIStats;
  settings: PortfolioSettings;
}

export const LiveArtifactView: React.FC<LiveArtifactViewProps> = ({
  plots,
  kpis,
  settings,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    const textSummary = `[รายงานสรุปพอร์ตที่ดิน: ${settings.portfolioTitle || 'คุณอภิวัชร์'}]
วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}
-----------------------------------------
• จำนวนแปลงทั้งหมด: ${kpis.totalPlots} แปลง (ถือครอง ${kpis.holdingPlots}, ขายแล้ว ${kpis.soldPlots}, ขายฝาก ${kpis.consignmentPlots})
• เนื้อที่รวมทั้งหมด: ${kpis.totalAreaRai.toLocaleString('th-TH')} ไร่ (${kpis.totalAreaSqWah.toLocaleString('th-TH')} ตร.ว.)
• ต้นทุนซื้อรวมทั้งสิ้น: ${formatCurrency(kpis.totalAcquisitionCost)}
• มูลค่าราคาที่ตั้งใจจะขาย: ${formatCurrency(kpis.totalTargetSalePrice)}
• กำไรคาดหวังรวม: +${formatCurrency(kpis.projectedGrossProfit)} (ROI: ${kpis.projectedROI.toFixed(1)}%)
• ยอดขายที่ได้รับจริงแล้ว: ${formatCurrency(kpis.totalRealizedSales)} (สุทธิ ${formatCurrency(kpis.totalNetReceived)})
-----------------------------------------
สรุปแปลงสำคัญ:
${plots.slice(0, 5).map((p) => `- แปลง #${p.orderNumber} ${p.title} (${p.province}) เนื้อที่ ${p.totalSqWah} ตร.ว. ต้นทุน ${formatCurrency(p.totalCost)}`).join('\n')}
`;
    navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    triggerPrint('portrait');
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 print:hidden">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Live Executive Artifact
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            รายงานสรุปพอร์ตการลงทุนที่ดิน (Live Artifact Presentation)
          </h2>
          <p className="text-xs text-slate-400">
            เอกสารสรุปภาพรวมสำหรับผู้บริหาร รายงานสถานะแบบ Real-time พร้อมพิมพ์หรือส่งออก
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                คัดลอกข้อความสรุปแล้ว
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                คัดลอกข้อความสรุป
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึกเป็น PDF
          </button>
        </div>
      </div>

      {/* Artifact Document Sheet (Styled for Screen and Clean Print) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 print:border-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg print:bg-emerald-700">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white print:text-slate-900">
                {settings.portfolioTitle || 'รายละเอียดการซื้อที่ดิน - อภิวัชร์'}
              </h1>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                เจ้าของพอร์ต: <span className="font-semibold text-slate-200 print:text-slate-900">{settings.ownerName || 'อภิวัชร์'}</span> • ระบบจัดการและวิเคราะห์การซื้อขายที่ดิน
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-400 print:text-slate-600">
            <div className="flex items-center sm:justify-end gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5" />
              ข้อมูล ณ วันที่: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="text-[11px] text-emerald-400 print:text-emerald-700 font-medium mt-0.5">
              สถานะข้อมูล: ซิงค์ล่าสุด (Hybrid Live Storage)
            </div>
          </div>
        </div>

        {/* 4 Summary Highlight Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-300">
            <span className="text-[11px] text-slate-400 print:text-slate-600 uppercase font-semibold">ต้นทุนรวมสุทธิ</span>
            <div className="text-xl font-bold text-white print:text-slate-900 font-mono mt-1">
              {formatCurrency(kpis.totalAcquisitionCost)}
            </div>
            <span className="text-[10px] text-slate-500 print:text-slate-600">
              ราคาซื้อ + ค่าโอน + รังวัด
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-300">
            <span className="text-[11px] text-slate-400 print:text-slate-600 uppercase font-semibold">เป้าหมายราคาขาย</span>
            <div className="text-xl font-bold text-emerald-400 print:text-emerald-700 font-mono mt-1">
              {formatCurrency(kpis.totalTargetSalePrice)}
            </div>
            <span className="text-[10px] text-emerald-500 print:text-emerald-700 font-medium">
              กำไรคาดหวัง +{kpis.projectedROI.toFixed(1)}%
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-300">
            <span className="text-[11px] text-slate-400 print:text-slate-600 uppercase font-semibold">เนื้อที่ดินรวม</span>
            <div className="text-xl font-bold text-amber-400 print:text-amber-800 font-mono mt-1">
              {kpis.totalAreaRai} ไร่
            </div>
            <span className="text-[10px] text-slate-500 print:text-slate-600">
              {kpis.totalAreaSqWah.toLocaleString('th-TH')} ตารางวา
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-300">
            <span className="text-[11px] text-slate-400 print:text-slate-600 uppercase font-semibold">สถานะแปลงที่ดิน</span>
            <div className="text-base font-bold text-white print:text-slate-900 mt-1 flex items-center gap-1.5">
              <span>{kpis.holdingPlots} ถือครอง</span>
              <span className="text-slate-500">/</span>
              <span className="text-emerald-400 print:text-emerald-700">{kpis.soldPlots} ขายแล้ว</span>
            </div>
            <span className="text-[10px] text-slate-500 print:text-slate-600">
              {kpis.consignmentPlots > 0 ? `รับขายฝาก ${kpis.consignmentPlots} แปลง` : 'ทั้งหมด ' + kpis.totalPlots + ' แปลง'}
            </span>
          </div>
        </div>

        {/* Portfolio Table in Artifact */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 print:text-slate-800">
            รายการแปลงที่ดินในพอร์ตการลงทุนทั้งหมด ({plots.length} รายการ)
          </h3>

          <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-300">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/80 print:bg-slate-100 text-slate-300 print:text-slate-700 font-semibold border-b border-slate-700 print:border-slate-300">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">รายละเอียดที่ดิน</th>
                  <th className="py-2.5 px-3">ประเภท</th>
                  <th className="py-2.5 px-3">จังหวัด</th>
                  <th className="py-2.5 px-3">เลขที่ดิน</th>
                  <th className="py-2.5 px-3 text-right">เนื้อที่</th>
                  <th className="py-2.5 px-3 text-right">ต้นทุนรวม</th>
                  <th className="py-2.5 px-3 text-right">ราคาตั้งขาย (KPI)</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 print:divide-slate-200">
                {plots.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 print:text-slate-600">{p.orderNumber}</td>
                    <td className="py-2 px-3 font-medium text-slate-100 print:text-slate-900">{p.title}</td>
                    <td className="py-2 px-3 text-slate-400 print:text-slate-600">{p.landType}</td>
                    <td className="py-2 px-3 text-slate-300 print:text-slate-700">{p.province}</td>
                    <td className="py-2 px-3 font-mono text-slate-300 print:text-slate-700">{p.primaryDeedNumber || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-200 print:text-slate-800">
                      {formatThaiArea(p.rai, p.ngan, p.sqWah)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-white print:text-slate-900">
                      {formatCurrency(p.totalCost)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-400 print:text-emerald-700">
                      {p.targetSalePrice > 0 ? formatCurrency(p.targetSalePrice) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[11px] font-medium text-slate-300 print:text-slate-700">
                        {p.status === 'sold'
                          ? 'ขายแล้ว'
                          : p.status === 'consignment'
                          ? 'ขายฝาก'
                          : p.status === 'for_sale'
                          ? 'กำลังขาย'
                          : 'ถือครอง'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-800/90 print:bg-slate-100 font-bold border-t border-slate-700 print:border-slate-300">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right">
                    ยอดรวมทั้งหมด ({plots.length} รายการ):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-400 print:text-amber-800">
                    {kpis.totalAreaSqWah.toLocaleString('th-TH')} ตร.ว.
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-white print:text-slate-900">
                    {formatCurrency(kpis.totalAcquisitionCost)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 print:text-emerald-700">
                    {formatCurrency(kpis.totalTargetSalePrice)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Executive Footnote */}
        <div className="pt-4 border-t border-slate-800/60 print:border-slate-300 text-[11px] text-slate-500 print:text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
          <div>
            รายงานนี้สร้างขึ้นโดยอัตโนมัติจากระบบ Land Portfolio & KPI Analytics • จัดเก็บแบบ Hybrid Storage
          </div>
          <div className="font-mono">
            Generated Live Artifact • AI Studio Build
          </div>
        </div>
      </div>
    </div>
  );
};
