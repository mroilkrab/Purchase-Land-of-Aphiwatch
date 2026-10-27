import React from 'react';
import { 
  X, 
  ArrowRightLeft, 
  MapPin, 
  ExternalLink, 
  Building, 
  Wallet, 
  TrendingUp, 
  Layers, 
  CheckCircle2, 
  Printer, 
  FileSpreadsheet,
  Award,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { formatCurrency, formatThaiArea, calculatePlotHoldingInfo } from '../services/storage';

interface LandComparisonModalProps {
  plots: LandPlot[];
  isOpen: boolean;
  onClose: () => void;
  onSelectPlot: (plot: LandPlot) => void;
  settings?: PortfolioSettings;
}

export const LandComparisonModal: React.FC<LandComparisonModalProps> = ({
  plots,
  isOpen,
  onClose,
  onSelectPlot,
  settings,
}) => {
  if (!isOpen || plots.length === 0) return null;

  // Best Value Calculations for highlight badges
  const lowestCostPerWah = Math.min(...plots.map((p) => p.pricePerSqWah || (p.totalSqWah > 0 ? p.totalCost / p.totalSqWah : Infinity)));
  const highestAreaWah = Math.max(...plots.map((p) => p.totalSqWah || 0));
  const highestRoi = Math.max(...plots.map((p) => {
    if (!p.totalCost || p.totalCost === 0) return 0;
    if (p.status === 'sold') {
      const net = p.netReceived || p.soldPrice || 0;
      return ((net - p.totalCost) / p.totalCost) * 100;
    }
    const target = p.targetSalePrice || (p.totalCost * 1.3);
    return ((target - p.totalCost) / p.totalCost) * 100;
  }));

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'หัวข้อเปรียบเทียบ',
      ...plots.map((p) => `แปลง #${p.orderNumber} - ${p.title.replace(/"/g, '""')}`),
    ];

    const rows: string[][] = [
      ['สถานะ', ...plots.map((p) => (p.status === 'sold' ? 'ขายแล้ว' : p.status === 'consignment' ? 'รับขายฝาก' : p.status === 'for_sale' ? 'กำลังประกาศขาย' : 'ถือครอง'))],
      ['ประเภทที่ดิน', ...plots.map((p) => p.landType || '-')],
      ['ที่ตั้ง (จังหวัด/อำเภอ)', ...plots.map((p) => `${p.province} / ${p.district}`)],
      ['เลขที่ดิน / โฉนดหลัก', ...plots.map((p) => p.primaryDeedNumber || '-')],
      ['ขนาดเนื้อที่รวม (ไร่-งาน-วา)', ...plots.map((p) => formatThaiArea(p.rai, p.ngan, p.sqWah))],
      ['เนื้อที่รวม (ตารางวา)', ...plots.map((p) => (p.totalSqWah || 0).toLocaleString('th-TH'))],
      ['ราคาซื้อที่ดิน (บาท)', ...plots.map((p) => p.purchasePrice.toLocaleString('th-TH'))],
      ['ค่าใช้จ่ายอื่น/ภาษี/รังวัด (บาท)', ...plots.map((p) => ((p.taxAndFees || 0) + (p.surveyCost || 0) + (p.otherExpenses || 0)).toLocaleString('th-TH'))],
      ['ต้นทุนรวมสุทธิทั้งสิ้น (บาท)', ...plots.map((p) => p.totalCost.toLocaleString('th-TH'))],
      ['ต้นทุนเฉลี่ยต่อตารางวา (บาท)', ...plots.map((p) => (p.totalSqWah > 0 ? Math.round(p.totalCost / p.totalSqWah).toLocaleString('th-TH') : '-'))],
      ['ราคาตั้งใจขาย (KPI Target)', ...plots.map((p) => (p.targetSalePrice ? p.targetSalePrice.toLocaleString('th-TH') : '-'))],
      ['กำไรคาดหวัง (บาท)', ...plots.map((p) => (p.targetSalePrice && p.targetSalePrice > p.totalCost ? (p.targetSalePrice - p.totalCost).toLocaleString('th-TH') : '-'))],
      ['คาดการณ์ ROI (%)', ...plots.map((p) => {
        if (!p.totalCost) return '-';
        const target = p.targetSalePrice || (p.totalCost * 1.3);
        return `${(((target - p.totalCost) / p.totalCost) * 100).toFixed(1)}%`;
      })],
      ['ระยะเวลาถือครอง', ...plots.map((p) => calculatePlotHoldingInfo(p.purchaseDate).formattedDuration)],
    ];

    const csvContent = '\uFEFF' + [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', url);
    dlAnchor.setAttribute('download', `land_comparison_${plots.map((p) => p.orderNumber).join('_')}_${Date.now()}.csv`);
    dlAnchor.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  เปรียบเทียบแปลงที่ดินเคียงข้างกัน (Land Comparison Grid)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {plots.length} แปลง
                </span>
              </div>
              <p className="text-xs text-slate-400">
                เปรียบเทียบมิติเนื้อที่ ต้นทุนต่อตารางวา ผลตอบแทนคาดหวัง และศักยภาพการลงทุนแบบเคียงข้างกัน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              title="ส่งออกผลการเปรียบเทียบเป็นไฟล์ CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">ส่งออก CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              title="พิมพ์ตารางเปรียบเทียบ"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Comparison Content */}
        <div className="overflow-auto flex-1 min-h-0 p-4 sm:p-6 space-y-6">
          {/* Side-by-side Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 shadow-inner">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-300">
                  <th className="p-3.5 font-semibold text-slate-400 w-44 min-w-[160px] sticky left-0 bg-slate-900 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    รายการเปรียบเทียบ
                  </th>
                  {plots.map((plot) => (
                    <th key={plot.id} className="p-3.5 font-bold text-white min-w-[220px] max-w-[280px] border-l border-slate-800/80">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-mono text-xs border border-emerald-500/30">
                          แปลง #{plot.orderNumber}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onSelectPlot(plot);
                          }}
                          className="text-[11px] font-normal text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" /> ดูรายละเอียด
                        </button>
                      </div>
                      <div className="font-semibold text-slate-100 text-sm line-clamp-1" title={plot.title}>
                        {plot.title}
                      </div>
                      <div className="text-[11px] font-normal text-slate-400">
                        {plot.subdistrict}, {plot.district}, {plot.province}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {/* 1. Status */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    สถานะปัจจุบัน
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          plot.status === 'sold'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : plot.status === 'consignment'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : plot.status === 'for_sale'
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
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
                    </td>
                  ))}
                </tr>

                {/* 2. Land Type */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ประเภทที่ดิน
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60 font-medium text-slate-300">
                      {plot.landType || '-'}
                    </td>
                  ))}
                </tr>

                {/* 3. Area Rai-Ngan-Wah */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ขนาดเนื้อที่ (ไร่-งาน-วา)
                  </td>
                  {plots.map((plot) => {
                    const isLargest = plot.totalSqWah === highestAreaWah && plots.length > 1;
                    return (
                      <td key={plot.id} className="p-3 border-l border-slate-800/60">
                        <div className="font-mono font-semibold text-white">
                          {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>{plot.totalSqWah?.toLocaleString('th-TH')} ตารางวา</span>
                          {isLargest && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.2 rounded font-semibold border border-amber-500/20">
                              <Award className="w-2.5 h-2.5" /> ใหญ่ที่สุด
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* 4. Purchase Price */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ราคาซื้อที่ดิน
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono text-slate-200">
                      {formatCurrency(plot.purchasePrice)}
                    </td>
                  ))}
                </tr>

                {/* 5. Additional Costs */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ภาษี ค่ารังวัด และอื่นๆ
                  </td>
                  {plots.map((plot) => {
                    const other = (plot.taxAndFees || 0) + (plot.surveyCost || 0) + (plot.otherExpenses || 0);
                    return (
                      <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono text-slate-400">
                        {formatCurrency(other)}
                      </td>
                    );
                  })}
                </tr>

                {/* 6. Total Acquisition Cost */}
                <tr className="bg-slate-900/70 hover:bg-slate-900">
                  <td className="p-3 font-semibold text-emerald-400 sticky left-0 bg-slate-900 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ต้นทุนรวมสุทธิ (Total Cost)
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono font-bold text-white text-sm sm:text-base">
                      {formatCurrency(plot.totalCost)}
                    </td>
                  ))}
                </tr>

                {/* 7. Cost per Sq.Wah */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ต้นทุนเฉลี่ย / ตร.ว.
                  </td>
                  {plots.map((plot) => {
                    const costPerWah = plot.totalSqWah > 0 ? Math.round(plot.totalCost / plot.totalSqWah) : 0;
                    const isLowest = costPerWah === lowestCostPerWah && plots.length > 1;
                    return (
                      <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono">
                        <span className="font-bold text-slate-100">{costPerWah.toLocaleString('th-TH')} ฿/ตร.ว.</span>
                        {isLowest && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                              <Sparkles className="w-2.5 h-2.5" /> ต้นทุน/วา ต่ำสุด
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 8. Target Sale Price */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ราคาตั้งใจขาย (KPI Target)
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono font-semibold text-emerald-400">
                      {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : 'ยังไม่ระบุ'}
                    </td>
                  ))}
                </tr>

                {/* 9. Projected Gross Profit */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ประมาณการกำไร
                  </td>
                  {plots.map((plot) => {
                    const profit = plot.targetSalePrice > 0 ? plot.targetSalePrice - plot.totalCost : 0;
                    return (
                      <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono font-semibold">
                        {profit > 0 ? (
                          <span className="text-emerald-400">+{formatCurrency(profit)}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 10. Projected ROI % */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    คาดการณ์ผลตอบแทน (ROI %)
                  </td>
                  {plots.map((plot) => {
                    const target = plot.targetSalePrice || (plot.totalCost * 1.3);
                    const roi = plot.totalCost > 0 ? ((target - plot.totalCost) / plot.totalCost) * 100 : 0;
                    const isHighest = roi === highestRoi && plots.length > 1;
                    return (
                      <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono">
                        <span className="font-bold text-cyan-300 text-sm">{roi.toFixed(1)}%</span>
                        {isHighest && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded-full font-semibold border border-cyan-500/30">
                              <Award className="w-2.5 h-2.5" /> ROI คาดหวังสูงสุด
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 11. Holding Duration */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    ระยะเวลาถือครองปัจจุบัน
                  </td>
                  {plots.map((plot) => {
                    const holding = calculatePlotHoldingInfo(plot.purchaseDate);
                    return (
                      <td key={plot.id} className="p-3 border-l border-slate-800/60 font-mono text-slate-300 text-xs">
                        <div>{holding.formattedDuration}</div>
                        <div className="text-[11px] text-slate-500">ซื้อเมื่อ: {plot.purchaseDate || '-'}</div>
                      </td>
                    );
                  })}
                </tr>

                {/* 12. Location & Maps */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    พิกัดและ Google Maps
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60 text-xs">
                      {plot.latitude && plot.longitude ? (
                        <div className="space-y-1">
                          <div className="font-mono text-emerald-400 text-[11px]">
                            {plot.latitude.toFixed(4)}, {plot.longitude.toFixed(4)}
                          </div>
                          <a
                            href={plot.mapsUrl || `https://www.google.com/maps?q=${plot.latitude},${plot.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline"
                          >
                            <MapPin className="w-3 h-3 text-rose-400" /> แผนที่ Google <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* 13. Deed Photos */}
                <tr className="hover:bg-slate-900/40">
                  <td className="p-3 font-medium text-slate-400 sticky left-0 bg-slate-950/95 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    รูปภาพโฉนดและสถานที่
                  </td>
                  {plots.map((plot) => (
                    <td key={plot.id} className="p-3 border-l border-slate-800/60">
                      {plot.images && plot.images.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {plot.images.slice(0, 2).map((img) => (
                            <img
                              key={img.id}
                              src={img.url}
                              alt={img.title}
                              className="w-12 h-12 object-cover rounded-lg border border-slate-700"
                            />
                          ))}
                          {plot.images.length > 2 && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              +{plot.images.length - 2} รูป
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">ไม่มีรูปภาพ</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            ระบบคำนวณเปรียบเทียบไฮไลต์แปลงที่ดินที่คุ้มค่าที่สุดโดยอัตโนมัติ
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            ปิดหน้าต่างเปรียบเทียบ
          </button>
        </div>
      </div>
    </div>
  );
};
