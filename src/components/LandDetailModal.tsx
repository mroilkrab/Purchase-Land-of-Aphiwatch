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
  Calendar
} from 'lucide-react';
import { LandPlot } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';

interface LandDetailModalProps {
  plot: LandPlot | null;
  onClose: () => void;
  onEdit: (plot: LandPlot) => void;
  onSimulate: (plot: LandPlot) => void;
}

export const LandDetailModal: React.FC<LandDetailModalProps> = ({
  plot,
  onClose,
  onEdit,
  onSimulate,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!plot) return null;

  const otherCosts = (plot.taxAndFees || 0) + (plot.surveyCost || 0) + (plot.otherExpenses || 0);
  const projectedProfit = (plot.targetSalePrice || 0) > 0 ? (plot.targetSalePrice || 0) - (plot.totalCost || 0) : 0;
  const projectedROI = (plot.totalCost || 0) > 0 ? (projectedProfit / (plot.totalCost || 0)) * 100 : 0;

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
                เลขที่โฉนด & แผนที่
              </span>
              <div className="text-base font-bold text-slate-200 font-mono">
                เลขที่ดิน: {plot.primaryDeedNumber || '-'}
              </div>
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
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
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
