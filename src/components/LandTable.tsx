import React, { useState } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { LandPlot, LandStatus } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';

interface LandTableProps {
  plots: LandPlot[];
  onSelectPlot: (plot: LandPlot) => void;
  onEditPlot: (plot: LandPlot) => void;
  onDeletePlot: (plotId: string) => void;
  onDuplicatePlot: (plot: LandPlot) => void;
  onAddNewPlot: () => void;
  onExportCsv: () => void;
}

export const LandTable: React.FC<LandTableProps> = ({
  plots,
  onSelectPlot,
  onEditPlot,
  onDeletePlot,
  onDuplicatePlot,
  onAddNewPlot,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [expandedPlots, setExpandedPlots] = useState<Record<string, boolean>>({
    'plot-1': true,
    'plot-10': true,
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPlots((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const provinces = Array.from(new Set(plots.map((p) => p.province).filter(Boolean)));

  const filteredPlots = plots.filter((plot) => {
    const matchesSearch =
      plot.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.subdistrict.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.province.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.primaryDeedNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plot.subParcels && plot.subParcels.some((sp) => sp.deedNumber.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesStatus = statusFilter === 'all' || plot.status === statusFilter;
    const matchesProvince = provinceFilter === 'all' || plot.province === provinceFilter;

    return matchesSearch && matchesStatus && matchesProvince;
  });

  // Calculate totals for filtered items
  const totalCostFiltered = filteredPlots.reduce((acc, p) => acc + (p.totalCost || 0), 0);
  const totalPurchaseFiltered = filteredPlots.reduce((acc, p) => acc + (p.purchasePrice || 0), 0);
  const totalTaxFiltered = filteredPlots.reduce((acc, p) => acc + (p.taxAndFees || 0), 0);
  const totalSurveyFiltered = filteredPlots.reduce((acc, p) => acc + (p.surveyCost || 0), 0);
  const totalOtherFiltered = filteredPlots.reduce((acc, p) => acc + (p.otherExpenses || 0), 0);
  const totalTargetSaleFiltered = filteredPlots.reduce((acc, p) => acc + (p.targetSalePrice || 0), 0);
  const totalSqWahFiltered = filteredPlots.reduce((acc, p) => acc + (p.totalSqWah || 0), 0);

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search, Filters, Export, Add */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-slate-900/90 rounded-xl border border-slate-800">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อแปลง, เลขที่โฉนด, ตำบล, อำเภอ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="holding">ถือครอง</option>
            <option value="for_sale">กำลังประกาศขาย</option>
            <option value="sold">ขายแล้ว</option>
            <option value="consignment">รับขายฝาก</option>
          </select>

          {/* Province Filter */}
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">ทุกจังหวัด</option>
            {provinces.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            title="ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Excel หรือ Numbers"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
          </button>

          <button
            onClick={onAddNewPlot}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            เพิ่มแปลงที่ดิน
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg">
        <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300 font-semibold sticky top-0 z-10">
              <th className="py-3 px-3 w-12 text-center">ลำดับ</th>
              <th className="py-3 px-3 w-24">วันที่ซื้อ</th>
              <th className="py-3 px-3 w-24">วันที่ขาย</th>
              <th className="py-3 px-4 min-w-[200px]">รายละเอียดที่ดิน / ประเภท</th>
              <th className="py-3 px-3">ตำบล/อำเภอ/จังหวัด</th>
              <th className="py-3 px-3">เลขที่ดิน</th>
              <th className="py-3 px-3 text-center">พิกัด Maps</th>
              <th className="py-3 px-3 text-right">เนื้อที่ (ไร่-งาน-วา)</th>
              <th className="py-3 px-3 text-right">รวม ตร.ว.</th>
              <th className="py-3 px-3 text-right">ราคาซื้อ</th>
              <th className="py-3 px-3 text-right">ภาษี/รังวัด/อื่นๆ</th>
              <th className="py-3 px-3 text-right font-bold text-white bg-slate-800">ต้นทุนรวมทั้งสิ้น</th>
              <th className="py-3 px-3 text-right text-emerald-400">ราคาตั้งใจขาย (KPI)</th>
              <th className="py-3 px-3 text-center">สถานะ</th>
              <th className="py-3 px-3 text-center w-28">จัดการ</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {filteredPlots.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-12 text-center text-slate-400">
                  ไม่พบข้อมูลแปลงที่ดินที่ตรงกับเงื่อนไขการค้นหา
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
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {plot.title}
                          {plot.images && plot.images.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-teal-400 border border-teal-500/30">
                              <ImageIcon className="w-2.5 h-2.5" /> {plot.images.length}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
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
                        {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {plot.totalSqWah.toLocaleString('th-TH')}
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
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onSelectPlot(plot)}
                            title="ดูรายละเอียดและรูปภาพ"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditPlot(plot)}
                            title="แก้ไขข้อมูล"
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDuplicatePlot(plot)}
                            title="ทำซ้ำแปลงนี้"
                            className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`ต้องการลบแปลง #${plot.orderNumber} "${plot.title}" หรือไม่?`)) {
                                onDeletePlot(plot.id);
                              }
                            }}
                            title="ลบแปลงที่ดิน"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Table Summary Footer (Grand Totals matching attachment) */}
          <tfoot className="bg-slate-800/90 font-semibold text-slate-200 border-t-2 border-slate-700">
            <tr>
              <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                รวมทั้งหมด ({filteredPlots.length} แปลง):
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
              <td className="py-3 px-3 text-right font-mono text-emerald-300">
                {formatCurrency(totalTargetSaleFiltered)}
              </td>
              <td colSpan={2} className="py-3 px-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
