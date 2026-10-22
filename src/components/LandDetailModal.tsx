import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  ExternalLink, 
  Building, 
  Wallet, 
  TrendingUp, 
  Edit3, 
  Layers, 
  FileText, 
  Maximize2,
  Calculator,
  Calendar,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea, calculatePlotHoldingInfo } from '../services/storage';

interface LandDetailModalProps {
  plot: LandPlot | null;
  onClose: () => void;
  onEdit: (plot: LandPlot) => void;
  onSimulate: (plot: LandPlot) => void;
  onDelete?: (plot: LandPlot) => void;
  settings?: PortfolioSettings;
}

export const LandDetailModal: React.FC<LandDetailModalProps> = ({
  plot,
  onClose,
  onEdit,
  onSimulate,
  onDelete,
  settings,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!plot) return null;

  const otherCosts = (plot.taxAndFees || 0) + (plot.surveyCost || 0) + (plot.otherExpenses || 0);
  const projectedProfit = (plot.targetSalePrice || 0) > 0 ? (plot.targetSalePrice || 0) - (plot.totalCost || 0) : 0;
  const projectedROI = (plot.totalCost || 0) > 0 ? (projectedProfit / (plot.totalCost || 0)) * 100 : 0;

  // Holding Period Calculations vs Settings
  const holdingInfo = calculatePlotHoldingInfo(plot.purchaseDate);
  const expectedHoldingMonths = settings?.expectedHoldingPeriodMonths || 12;
  const isSold = plot.status === 'sold';
  const monthsHeld = holdingInfo.monthsHeld;
  const progressPercent = expectedHoldingMonths > 0 
    ? Math.round((monthsHeld / expectedHoldingMonths) * 100) 
    : 0;
  const isOverdue = !isSold && monthsHeld > expectedHoldingMonths;
  const monthsOverdue = isOverdue ? monthsHeld - expectedHoldingMonths : 0;
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/80 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold flex items-center justify-center border border-emerald-500/20 text-sm">
              #{plot.orderNumber}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {plot.title}
              </h2>
              <p className="text-xs text-slate-400">
                {plot.subdistrict}, {plot.district}, {plot.province} • ประเภท: {plot.landType}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs sm:text-sm">
          {/* Status & Date Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">สถานะ:</span>
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
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

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                ซื้อ: <span className="text-slate-200">{plot.purchaseDate || '-'}</span>
              </span>
              {plot.saleDate && (
                <span className="flex items-center gap-1 font-mono text-rose-400">
                  ขาย: {plot.saleDate}
                </span>
              )}
            </div>
          </div>

          {/* Visual Holding Time vs Expected Holding Period Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            isOverdue 
              ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/20' 
              : progressPercent >= 75 && !isSold
              ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/30'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isOverdue 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' 
                    : progressPercent >= 75 && !isSold
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 text-xs sm:text-sm flex items-center gap-1.5">
                    <span>ความคืบหน้าระยะเวลาถือครอง</span>
                    <span className="text-slate-500 font-normal text-xs hidden sm:inline">(Holding Period Tracker)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    เทียบระยะเวลาถือครองจริงกับเป้าหมายระบบ ({expectedHoldingMonths} เดือน)
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="self-start sm:self-auto">
                {isSold ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ขายสำเร็จแล้ว (ถือครอง {holdingInfo.formattedDuration})
                  </span>
                ) : isOverdue ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" /> เกินเป้าหมาย {progressPercent}% (+{monthsOverdue} เดือน)
                  </span>
                ) : progressPercent >= 75 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Hourglass className="w-3.5 h-3.5" /> ใกล้ครบกำหนด {progressPercent}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ตามเป้าหมาย {progressPercent}%
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5 my-3">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="text-slate-400">
                  เริ่มซื้อ: <span className="text-slate-200">{plot.purchaseDate || '-'}</span>
                </span>
                <span className={`font-semibold ${isOverdue ? 'text-rose-400' : progressPercent >= 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {progressPercent}% ของเป้าหมาย {expectedHoldingMonths} เดือน
                </span>
              </div>

              <div className="relative h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                {/* 100% Target Mark */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                  style={{ left: '100%' }}
                  title="เป้าหมาย 100%"
                />
                
                {/* Progress Fill */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSold
                      ? 'bg-slate-600'
                      : isOverdue
                      ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 shadow-md shadow-rose-600/40'
                      : progressPercent >= 75
                      ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>0 เดือน</span>
                <span>{Math.round(expectedHoldingMonths / 2)} เดือน (50%)</span>
                <span className="text-slate-400 font-semibold">{expectedHoldingMonths} เดือน (เป้าหมาย 100%)</span>
              </div>
            </div>

            {/* 4 Informative Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block mb-0.5">ถือครองจริงแล้ว</span>
                <span className="font-mono font-bold text-white text-xs sm:text-sm block">
                  {holdingInfo.formattedDuration}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({monthsHeld} เดือน)
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block mb-0.5">เป้าหมายระบบ</span>
                <span className="font-mono font-bold text-slate-200 text-xs sm:text-sm block">
                  {expectedHoldingMonths} เดือน
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({expectedHoldingMonths >= 12 ? `${expectedHoldingMonths / 12} ปี` : 'ระยะสั้น'})
                </span>
              </div>

              <div className={`p-2.5 rounded-lg border text-xs ${
                isOverdue 
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' 
                  : 'bg-slate-900/80 border-slate-800/60 text-slate-300'
              }`}>
                <span className="text-[11px] text-slate-400 block mb-0.5">สถานะกำหนดการ</span>
                {isSold ? (
                  <span className="font-semibold text-slate-300 text-xs sm:text-sm block">
                    ขายเรียบร้อยแล้ว
                  </span>
                ) : isOverdue ? (
                  <span className="font-bold text-rose-400 text-xs sm:text-sm block font-mono">
                    เกิน {monthsOverdue} เดือน
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-400 text-xs sm:text-sm block font-mono">
                    เหลือ {expectedHoldingMonths - monthsHeld} เดือน
                  </span>
                )}
                <span className="text-[10px] text-slate-500">
                  {isOverdue ? 'ควรเร่งการตลาด/ทบทวนราคา' : isSold ? 'ปิดดีลแล้ว' : 'อยู่ในเกณฑ์ปกติ'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block mb-0.5">ต้นทุนผูกพัน</span>
                <span className="font-mono font-bold text-amber-400 text-xs sm:text-sm block">
                  {formatCurrency(plot.totalCost)}
                </span>
                <span className="text-[10px] text-slate-500">
                  เงินทุนที่ค้างอยู่ในแปลงนี้
                </span>
              </div>
            </div>
          </div>

          {/* Area & Deed Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                ขนาดเนื้อที่ดิน
              </span>
              <div className="text-xl font-bold text-white font-mono">
                {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
              </div>
              <div className="text-xs text-slate-400">
                รวมทั้งหมด <span className="text-amber-400 font-bold font-mono">{plot.totalSqWah?.toLocaleString('th-TH')} ตารางวา</span>
                {plot.totalRai > 0 && <span className="text-slate-500 ml-1">({plot.totalRai} ไร่)</span>}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                เลขที่โฉนด & แผนที่ระบุพิกัด
              </span>
              <div className="text-base font-bold text-slate-200 font-mono">
                เลขที่ดิน: {plot.primaryDeedNumber || '-'}
              </div>
              {plot.latitude && plot.longitude && (
                <div className="text-xs font-mono text-emerald-400">
                  พิกัด: {plot.latitude.toFixed(5)}° N, {plot.longitude.toFixed(5)}° E
                </div>
              )}
              {plot.mapsUrl ? (
                <a
                  href={plot.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  เปิดตำแหน่งใน Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-xs text-slate-500">ไม่ได้ระบุพิกัดแผนที่</span>
              )}
            </div>
          </div>

          {/* Interactive Map Visualizer in Detail Modal */}
          {plot.latitude && plot.longitude && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 space-y-2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> แผนที่แสดงตำแหน่งจริงของแปลง #{plot.orderNumber}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {plot.latitude.toFixed(4)}, {plot.longitude.toFixed(4)}
                </span>
              </div>
              <div className="relative aspect-[21/9] sm:aspect-[24/9] rounded-lg overflow-hidden border border-slate-800">
                <iframe
                  title={`Map preview for ${plot.title}`}
                  className="w-full h-full border-0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${plot.longitude - 0.008}%2C${plot.latitude - 0.006}%2C${plot.longitude + 0.008}%2C${plot.latitude + 0.006}&layer=mapnik&marker=${plot.latitude}%2C${plot.longitude}`}
                />
              </div>
            </div>
          )}

          {/* Sub-parcels (if any) */}
          {plot.subParcels && plot.subParcels.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                โฉนดย่อยในแปลงนี้ ({plot.subParcels.length} โฉนด)
              </h4>
              <div className="space-y-2">
                {plot.subParcels.map((sp, idx) => (
                  <div
                    key={sp.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-slate-500 font-mono mr-2">#{idx + 1}</span>
                      <span className="font-mono text-emerald-400 font-semibold mr-2">โฉนด {sp.deedNumber}</span>
                      <span className="text-slate-400">({sp.notes || 'แปลงย่อย'})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-300">
                        {formatThaiArea(sp.rai, sp.ngan, sp.sqWah)} ({sp.totalSqWah} ตร.ว.)
                      </span>
                      {sp.mapsUrl && (
                        <a
                          href={sp.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 p-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-400" />
              โครงสร้างต้นทุนและราคาซื้อ
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">ราคาซื้อที่ดิน:</span>
                <span className="font-mono font-semibold text-white">{formatCurrency(plot.purchasePrice)}</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">ค่าธรรมเนียม/ภาษี:</span>
                <span className="font-mono text-slate-300">{formatCurrency(plot.taxAndFees)}</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">ค่ารังวัด:</span>
                <span className="font-mono text-slate-300">{formatCurrency(plot.surveyCost)}</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">ค่าใช้จ่ายอื่นๆ:</span>
                <span className="font-mono text-slate-300">{formatCurrency(plot.otherExpenses)}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-blue-500/30 flex justify-between items-center">
              <span className="text-xs text-blue-300 font-semibold">ต้นทุนรวมสุทธิทั้งสิ้น:</span>
              <span className="text-base font-bold text-white font-mono">
                {formatCurrency(plot.totalCost)}
              </span>
            </div>
          </div>

          {/* Target Selling Price & KPI */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              ราคาที่ตั้งใจจะขาย (KPI Target) & ประมาณการกำไร
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900 p-3 rounded-lg border border-emerald-500/20">
                <span className="text-slate-400 text-xs block">ราคาตั้งใจขาย:</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : 'ยังไม่ระบุ'}
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">กำไรคาดหวัง:</span>
                <span className="text-lg font-bold text-white font-mono">
                  {projectedProfit > 0 ? `+${formatCurrency(projectedProfit)}` : '-'}
                </span>
              </div>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">คาดการณ์ ROI %:</span>
                <span className="text-lg font-bold text-emerald-300 font-mono">
                  {projectedROI > 0 ? `${projectedROI.toFixed(1)}%` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          {plot.images && plot.images.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-200 text-xs">
                รูปภาพโฉนดและสถานที่ ({plot.images.length} รูป)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {plot.images.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedImage(img.url)}
                    className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video cursor-pointer"
                  >
                    <img
                      src={img.url}
                      alt={img.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {plot.notes && (
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1">
              <span className="text-xs text-slate-400 font-medium">หมายเหตุ:</span>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{plot.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onSimulate(plot);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              คำนวณราคาขาย (KPI Simulator)
            </button>

            {onDelete && (
              <div>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    title="ลบแปลงนี้ออกจากระบบ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ลบแปลงนี้
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-rose-950/60 p-1 px-2.5 rounded-xl border border-rose-800/80">
                    <span className="text-[11px] text-rose-300 font-medium">ยืนยันลบ?</span>
                    <button
                      onClick={() => {
                        onClose();
                        onDelete(plot);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      ใช่, ลบ
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(plot);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              แก้ไขข้อมูล
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Zooming Images */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white bg-slate-800 rounded-full hover:bg-slate-700"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            alt="Enlarged Deed Document"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
};
