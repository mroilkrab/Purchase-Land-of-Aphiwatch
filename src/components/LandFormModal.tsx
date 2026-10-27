import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Upload, 
  MapPin, 
  Building, 
  Layers, 
  Coins, 
  Calculator, 
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  Printer,
  ExternalLink,
  RefreshCw,
  Scale,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { LandPlot, SubParcel, LandPlotImage, LandStatus, LandTaxUsageType } from '../types/land';
import { formatThaiArea, formatCurrency } from '../services/storage';
import { compressImageForStorage } from '../services/dbStorage';
import { calculateLandTax, inferDefaultTaxUsage, TAX_USAGE_CONFIGS } from '../services/landTax';

interface LandFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plot: LandPlot) => void;
  onDelete?: (plotId: string) => void;
  initialData?: LandPlot | null;
  nextOrderNumber: number;
  isGoogleAuthed?: boolean;
  googleSheetId?: string;
  onLoginGoogle?: () => void;
  isSyncingSheet?: boolean;
  sheetSyncStatus?: {
    status: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
    sheetUrl?: string;
    lastSynced?: string;
  };
}

export const LandFormModal: React.FC<LandFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  nextOrderNumber,
  isGoogleAuthed = false,
  googleSheetId,
  onLoginGoogle,
  isSyncingSheet = false,
  sheetSyncStatus,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [autoSyncSheet, setAutoSyncSheet] = useState<boolean>(true);

  const getInitialFormData = (data?: LandPlot | null, nextOrder: number = 1): Partial<LandPlot> => {
    if (data) {
      return {
        ...data,
        id: data.id,
        orderNumber: Number(data.orderNumber) || nextOrder,
        purchaseDate: data.purchaseDate || '',
        saleDate: data.saleDate || '',
        title: data.title || '',
        landType: data.landType || 'ที่ดินเปล่า',
        subdistrict: data.subdistrict || '',
        district: data.district || '',
        province: data.province || 'นครสวรรค์',
        primaryDeedNumber: data.primaryDeedNumber || '',
        mapsUrl: data.mapsUrl || '',
        latitude: data.latitude,
        longitude: data.longitude,
        rai: Number(data.rai) || 0,
        ngan: Number(data.ngan) || 0,
        sqWah: Number(data.sqWah) || 0,
        totalRai: Number(data.totalRai) || 0,
        totalSqWah: Number(data.totalSqWah) || 0,
        pricePerRai: Number(data.pricePerRai) || 0,
        pricePerSqWah: Number(data.pricePerSqWah) || 0,
        purchasePrice: Number(data.purchasePrice) || 0,
        taxAndFees: Number(data.taxAndFees) || 0,
        surveyCost: Number(data.surveyCost) || 0,
        otherExpenses: Number(data.otherExpenses) || 0,
        totalCost: Number(data.totalCost) || 0,
        targetSalePrice: Number(data.targetSalePrice) || 0,
        soldPrice: Number(data.soldPrice) || 0,
        commissionFee: Number(data.commissionFee) || 0,
        netReceived: Number(data.netReceived) || 0,
        partiallySoldRai: Number(data.partiallySoldRai) || 0,
        partiallySoldNgan: Number(data.partiallySoldNgan) || 0,
        partiallySoldSqWah: Number(data.partiallySoldSqWah) || 0,
        partiallySoldTotalSqWah: Number(data.partiallySoldTotalSqWah) || 0,
        remainingSqWah: data.remainingSqWah !== undefined && data.remainingSqWah !== null
          ? Number(data.remainingSqWah)
          : (Number(data.totalSqWah) || 0),
        status: data.status || 'holding',
        notes: data.notes || '',
        subParcels: Array.isArray(data.subParcels)
          ? data.subParcels.map((sp) => ({
              id: sp.id || `sp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              deedNumber: sp.deedNumber || '',
              rai: Number(sp.rai) || 0,
              ngan: Number(sp.ngan) || 0,
              sqWah: Number(sp.sqWah) || 0,
              totalSqWah: Number(sp.totalSqWah) || 0,
              mapsUrl: sp.mapsUrl || '',
              latitude: sp.latitude,
              longitude: sp.longitude,
              notes: sp.notes || '',
            }))
          : [],
        images: Array.isArray(data.images) ? [...data.images] : [],
        appraisalPrice: data.appraisalPrice !== undefined && data.appraisalPrice !== null ? Number(data.appraisalPrice) : undefined,
        taxUsageType: data.taxUsageType,
        isIndividualOwner: data.isIndividualOwner !== false,
        vacantConsecutiveYears: Number(data.vacantConsecutiveYears) || 0,
      };
    }
    return {
      id: `plot-${Date.now()}`,
      orderNumber: nextOrder,
      purchaseDate: new Date().toLocaleDateString('th-TH'),
      saleDate: '',
      title: '',
      landType: 'ที่ดินเปล่า',
      subdistrict: '',
      district: '',
      province: 'นครสวรรค์',
      primaryDeedNumber: '',
      mapsUrl: '',
      rai: 0,
      ngan: 0,
      sqWah: 0,
      totalRai: 0,
      totalSqWah: 0,
      pricePerRai: 0,
      pricePerSqWah: 0,
      purchasePrice: 0,
      taxAndFees: 0,
      surveyCost: 0,
      otherExpenses: 0,
      totalCost: 0,
      targetSalePrice: 0,
      soldPrice: 0,
      commissionFee: 0,
      netReceived: 0,
      partiallySoldRai: 0,
      partiallySoldNgan: 0,
      partiallySoldSqWah: 0,
      partiallySoldTotalSqWah: 0,
      remainingSqWah: 0,
      status: 'holding',
      notes: '',
      subParcels: [],
      images: [],
      isIndividualOwner: true,
      vacantConsecutiveYears: 0,
    };
  };

  const [formData, setFormData] = useState<Partial<LandPlot>>(() => getInitialFormData(initialData, nextOrderNumber));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(getInitialFormData(initialData, nextOrderNumber));
  }, [initialData, nextOrderNumber, isOpen]);

  if (!isOpen) return null;

  const safeLocaleNumber = (val: any): string => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString('th-TH');
  };

  // Auto-calculation functions
  const recalculateAreaAndPrices = (updates: Partial<LandPlot>) => {
    const current = { ...formData, ...updates };

    const rai = Number(current.rai) || 0;
    const ngan = Number(current.ngan) || 0;
    const sqWah = Number(current.sqWah) || 0;
    const totalSqWah = rai * 400 + ngan * 100 + sqWah;
    const totalRai = totalSqWah / 400;

    const purchasePrice = Number(current.purchasePrice) || 0;
    const taxAndFees = Number(current.taxAndFees) || 0;
    const surveyCost = Number(current.surveyCost) || 0;
    const otherExpenses = Number(current.otherExpenses) || 0;
    const totalCost = purchasePrice + taxAndFees + surveyCost + otherExpenses;

    const pricePerSqWah = totalSqWah > 0 ? Math.round(purchasePrice / totalSqWah) : 0;
    const pricePerRai = totalRai > 0 ? Math.round(purchasePrice / totalRai) : 0;

    // Sales net calculation
    const soldPrice = Number(current.soldPrice) || 0;
    const commissionFee = Number(current.commissionFee) || 0;
    const netReceived = soldPrice > 0 ? soldPrice - commissionFee : Number(current.netReceived) || 0;

    setFormData({
      ...current,
      totalSqWah,
      totalRai: Number(totalRai.toFixed(4)),
      totalCost,
      pricePerSqWah,
      pricePerRai,
      netReceived,
    });
  };

  const handleSubParcelAdd = () => {
    const newSp: SubParcel = {
      id: `sp-${Date.now()}`,
      deedNumber: '',
      rai: 0,
      ngan: 0,
      sqWah: 0,
      totalSqWah: 0,
      mapsUrl: '',
      notes: '',
    };
    setFormData({
      ...formData,
      subParcels: [...(formData.subParcels || []), newSp],
    });
  };

  const handleSubParcelUpdate = (id: string, updates: Partial<SubParcel>) => {
    const updated = (formData.subParcels || []).map((sp) => {
      if (sp.id === id) {
        const next = { ...sp, ...updates };
        const totalSqWah = (Number(next.rai) || 0) * 400 + (Number(next.ngan) || 0) * 100 + (Number(next.sqWah) || 0);
        return { ...next, totalSqWah };
      }
      return sp;
    });
    setFormData({ ...formData, subParcels: updated });
  };

  const handleSubParcelRemove = (id: string) => {
    setFormData({
      ...formData,
      subParcels: (formData.subParcels || []).filter((sp) => sp.id !== id),
    });
  };

  // Image Upload handler with image compression to prevent memory overflow
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const compressedUrl = await compressImageForStorage(file, 1600, 0.82);
        const newImage: LandPlotImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          url: compressedUrl,
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: 'deed',
          uploadedAt: new Date().toISOString(),
        };
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), newImage],
        }));
      } catch (err) {
        console.warn('Image processing error:', err);
      }
    }
  };

  const handleImageDelete = (imgId: string) => {
    setFormData((prev) => ({
      ...prev,
      images: (prev.images || []).filter((img) => img.id !== imgId),
    }));
  };

  // Live Land and Building Tax Calculation for this plot
  const liveTaxResult = useMemo(() => {
    const appraisal = Number(formData.appraisalPrice) > 0 
      ? Number(formData.appraisalPrice) 
      : (Number(formData.purchasePrice) || 0);
    const usageType = formData.taxUsageType || inferDefaultTaxUsage(formData.landType);
    const isIndividual = formData.isIndividualOwner !== false;
    const vacantYears = Number(formData.vacantConsecutiveYears) || 0;

    return calculateLandTax({
      appraisalPrice: appraisal,
      usageType,
      isIndividualOwner: isIndividual,
      vacantYears,
      monthsHeld: 12,
    });
  }, [formData.appraisalPrice, formData.purchasePrice, formData.taxUsageType, formData.landType, formData.isIndividualOwner, formData.vacantConsecutiveYears]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setFormError('กรุณาระบุรายละเอียดหรือชื่อแปลงที่ดิน');
      return;
    }
    setFormError(null);

    const appraisal = Number(formData.appraisalPrice) > 0 
      ? Number(formData.appraisalPrice) 
      : (Number(formData.purchasePrice) || 0);
    const usageType = formData.taxUsageType || inferDefaultTaxUsage(formData.landType);
    const isIndividual = formData.isIndividualOwner !== false;
    const vacantYears = Number(formData.vacantConsecutiveYears) || 0;

    const finalPlot: LandPlot = {
      ...(formData as LandPlot),
      id: formData.id || `plot-${Date.now()}`,
      orderNumber: Number(formData.orderNumber) || nextOrderNumber,
      appraisalPrice: appraisal,
      taxUsageType: usageType,
      isIndividualOwner: isIndividual,
      vacantConsecutiveYears: vacantYears,
      annualLandTax: liveTaxResult.annualTax,
      updatedAt: new Date().toISOString(),
    };

    onSave(finalPlot);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/60 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {initialData ? `แก้ไขแปลงที่ดิน #${formData.orderNumber}: ${formData.title}` : 'เพิ่มแปลงที่ดินใหม่ในพอร์ต'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs sm:text-sm">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Google Sheets Auto-Sync Notification Card */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">
                    {isGoogleAuthed ? 'Google Sheets Auto-Sync: พร้อมใช้งาน' : 'บันทึกเข้าสู่ Google Sheets อัตโนมัติ'}
                  </span>
                  {isGoogleAuthed && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> เชื่อมต่อแล้ว
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isGoogleAuthed
                    ? 'เมื่อกดยืนยันบันทึก ระบบจะจัดเก็บข้อมูลลงตารางในระบบ และอัพเดตเข้าตาราง Google Sheets ของคุณทันที'
                    : 'เข้าสู่ระบบ Google เพื่อให้อัพเดตข้อมูลเข้า Google Sheets แบบเรียลไทม์เมื่อมีการเพิ่มหรือแก้ไขแปลง'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isGoogleAuthed && googleSheetId && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${googleSheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>เปิด Google Sheet</span>
                </a>
              )}
              {!isGoogleAuthed && onLoginGoogle && (
                <button
                  type="button"
                  onClick={onLoginGoogle}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  เข้าสู่ระบบ Google
                </button>
              )}
            </div>
          </div>

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 1. ข้อมูลพื้นฐานและทำเลที่ตั้ง
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">ลำดับ (#)</label>
                <input
                  type="number"
                  value={formData.orderNumber || ''}
                  onChange={(e) => setFormData({ ...formData, orderNumber: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">รายละเอียดที่ดิน / ชื่อแปลง *</label>
                <input
                  type="text"
                  placeholder="เช่น ที่ดินนครสวรรค์ จากสมยศ, บ้านมัณฑนา วัชรพล 2"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">ประเภทเอกสารสิทธิ์ / ที่ดิน</label>
                <select
                  value={formData.landType || 'ที่ดินเปล่า'}
                  onChange={(e) => setFormData({ ...formData, landType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ที่ดินเปล่า">ที่ดินเปล่า</option>
                  <option value="ที่ดินเปล่า (แบ่งโฉนด)">ที่ดินเปล่า (แบ่งโฉนด)</option>
                  <option value="บ้านพร้อมที่ดิน">บ้านพร้อมที่ดิน</option>
                  <option value="ขายฝาก">ขายฝาก</option>
                  <option value="น.ส.3">น.ส.3</option>
                  <option value="อาคารพาณิชย์/ตึกแถว">อาคารพาณิชย์/ตึกแถว</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">ตำบล/แขวง</label>
                <input
                  type="text"
                  placeholder="เช่น พระนอน, ท่าแร้ง"
                  value={formData.subdistrict || ''}
                  onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">อำเภอ/เขต</label>
                <input
                  type="text"
                  placeholder="เช่น เมืองนครสวรรค์, บางเขน"
                  value={formData.district || ''}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">จังหวัด</label>
                <input
                  type="text"
                  placeholder="เช่น นครสวรรค์, กรุงเทพฯ, เพชรบูรณ์"
                  value={formData.province || ''}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">เลขที่ดิน / เลขที่โฉนดหลัก</label>
                <input
                  type="text"
                  placeholder="เช่น 140845, 139809"
                  value={formData.primaryDeedNumber || ''}
                  onChange={(e) => setFormData({ ...formData, primaryDeedNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="sm:col-span-8">
                <label className="block text-xs text-slate-400 mb-1">ลิงก์ตำแหน่ง Google Maps</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://maps.app.goo.gl/... หรือ https://maps.google.com/?q=15.6835,100.2285"
                    value={formData.mapsUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const next: Partial<LandPlot> = { mapsUrl: val };
                      // Try extracting lat/lng if url contains @lat,lng or q=lat,lng
                      const match = val.match(/@([0-9.-]+),([0-9.-]+)/) || val.match(/q=([0-9.-]+),([0-9.-]+)/);
                      if (match) {
                        next.latitude = parseFloat(match[1]);
                        next.longitude = parseFloat(match[2]);
                      }
                      setFormData({ ...formData, ...next });
                    }}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                  />
                  {formData.mapsUrl && (
                    <a
                      href={formData.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 flex items-center gap-1"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">พิกัดละติจูด (Latitude)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="เช่น 15.6835"
                  value={formData.latitude ?? ''}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">พิกัดลองจิจูด (Longitude)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="เช่น 100.2285"
                  value={formData.longitude ?? ''}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Land Area (ขนาดที่ดิน) */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> 2. ขนาดเนื้อที่ดิน (คำนวณอัตโนมัติ 1 ไร่ = 4 งาน = 400 ตารางวา)
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">ไร่</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.rai ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ rai: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">งาน</label>
                <input
                  type="number"
                  min="0"
                  max="3"
                  step="1"
                  value={formData.ngan ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ ngan: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">ตารางวา</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.sqWah ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ sqWah: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                />
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block">รวมจำนวนที่ดิน (ไร่):</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {Number(formData.totalRai || 0)} ไร่
                </span>
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block">รวมจำนวนที่ดิน (ตร.ว.):</span>
                <span className="text-sm font-bold text-amber-300 font-mono">
                  {safeLocaleNumber(formData.totalSqWah)} ตร.ว.
                </span>
              </div>
            </div>

            {/* Partial sales and remaining area inputs */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
              <div>
                <span className="text-xs font-semibold text-slate-200">ขายไปบางส่วน (ถ้ามี) & เนื้อที่คงเหลือ</span>
                <p className="text-[11px] text-slate-400">กรณีตัดแบ่งขายบางส่วน เช่น แปลงเดิม 5-0-54 ไร่ ขายไป 3-0-54 ไร่ คงเหลือ 800 ตร.ว.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ขายไป (ไร่)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.partiallySoldRai ?? 0}
                    onChange={(e) => {
                      const r = Number(e.target.value);
                      const n = formData.partiallySoldNgan || 0;
                      const w = formData.partiallySoldSqWah || 0;
                      const soldTotal = r * 400 + n * 100 + w;
                      const totalSqW = formData.totalSqWah || 0;
                      setFormData({
                        ...formData,
                        partiallySoldRai: r,
                        partiallySoldTotalSqWah: soldTotal,
                        remainingSqWah: Math.max(0, totalSqW - soldTotal),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ขายไป (งาน)</label>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    value={formData.partiallySoldNgan ?? 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const r = formData.partiallySoldRai || 0;
                      const w = formData.partiallySoldSqWah || 0;
                      const soldTotal = r * 400 + n * 100 + w;
                      const totalSqW = formData.totalSqWah || 0;
                      setFormData({
                        ...formData,
                        partiallySoldNgan: n,
                        partiallySoldTotalSqWah: soldTotal,
                        remainingSqWah: Math.max(0, totalSqW - soldTotal),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ขายไป (ตร.ว.)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.partiallySoldSqWah ?? 0}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      const r = formData.partiallySoldRai || 0;
                      const n = formData.partiallySoldNgan || 0;
                      const soldTotal = r * 400 + n * 100 + w;
                      const totalSqW = formData.totalSqWah || 0;
                      setFormData({
                        ...formData,
                        partiallySoldSqWah: w,
                        partiallySoldTotalSqWah: soldTotal,
                        remainingSqWah: Math.max(0, totalSqW - soldTotal),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs"
                  />
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 block">ขายไปรวม (ตร.ว.):</span>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {safeLocaleNumber(formData.partiallySoldTotalSqWah)} ตร.ว.
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80">
                  <span className="text-[10px] text-slate-400 block">เนื้อที่คงเหลือ:</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {safeLocaleNumber(
                      formData.remainingSqWah !== undefined && formData.remainingSqWah !== null
                        ? formData.remainingSqWah
                        : (formData.totalSqWah || 0)
                    )} ตร.ว.
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-parcels Section */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">
                    โฉนดย่อยในแปลงนี้ ({formData.subParcels?.length || 0} แปลงย่อย)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    ใช้กรณีซื้อที่ดินหลายโฉนดรวมเป็นดีลเดียว (เช่น แปลง 140845, 140847, 140848, 140849)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSubParcelAdd}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มโฉนดย่อย
                </button>
              </div>

              {formData.subParcels && formData.subParcels.length > 0 && (
                <div className="space-y-2">
                  {formData.subParcels.map((sp, idx) => (
                    <div
                      key={sp.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <span className="sm:col-span-1 text-[11px] font-mono text-slate-500">
                        #{idx + 1}
                      </span>
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          placeholder="เลขที่ดิน เช่น 140847"
                          value={sp.deedNumber || ''}
                          onChange={(e) => handleSubParcelUpdate(sp.id, { deedNumber: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="ไร่"
                          value={sp.rai ?? 0}
                          onChange={(e) => handleSubParcelUpdate(sp.id, { rai: Number(e.target.value) })}
                          className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                        />
                        <span className="text-[10px] text-slate-400">ไร่</span>
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="url"
                          placeholder="ลิงก์ Google Maps"
                          value={sp.mapsUrl || ''}
                          onChange={(e) => handleSubParcelUpdate(sp.id, { mapsUrl: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSubParcelRemove(sp.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Costs and Expenses */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <Coins className="w-4 h-4" /> 3. ต้นทุนและค่าใช้จ่าย (Acquisition Costs)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">ราคารวม / ราคาซื้อ (บาท) *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.purchasePrice ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ purchasePrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono font-bold text-sm text-blue-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">จ่ายค่าธรรมเนียม/ภาษี/อากร (บาท)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.taxAndFees ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ taxAndFees: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">จ่ายค่ารังวัด (บาท)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.surveyCost ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ surveyCost: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">จ่ายค่าใช้จ่ายอื่นๆ (บาท)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.otherExpenses ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ otherExpenses: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Total Cost Display Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-blue-300 font-medium">รวมทั้งสิ้น / ต้นทุนสุทธิทั้งหมด (Total Cost)</span>
                <div className="text-xl sm:text-2xl font-bold text-white font-mono mt-0.5">
                  {safeLocaleNumber(formData.totalCost)} บาท
                </div>
              </div>

              <div className="flex gap-4 text-xs font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block">เฉลี่ยไร่ละ:</span>
                  <span className="text-slate-200 font-semibold">{safeLocaleNumber(formData.pricePerRai)} ฿</span>
                </div>
                <div>
                  <span className="text-slate-500 block">เฉลี่ยตารางวาละ:</span>
                  <span className="text-slate-200 font-semibold">{safeLocaleNumber(formData.pricePerSqWah)} ฿</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Land and Building Tax Act B.E. 2562 */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <Receipt className="w-4 h-4" /> 4. ภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. ภาษีที่ดินฯ พ.ศ. 2562)
              </h3>
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                คำนวณอัตโนมัติตามราคาประเมินและประเภทการใช้ประโยชน์
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Appraisal Price Input */}
              <div className="sm:col-span-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">ราคาประเมินทุนทรัพย์ที่ดิน (บาท)</label>
                  {Number(formData.purchasePrice) > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, appraisalPrice: Number(formData.purchasePrice) })}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium underline cursor-pointer"
                    >
                      ใช้ราคาซื้อ
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder={formData.purchasePrice ? String(formData.purchasePrice) : 'เช่น 1,500,000'}
                  value={formData.appraisalPrice ?? ''}
                  onChange={(e) => setFormData({ ...formData, appraisalPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-rose-500 font-mono font-semibold"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  หากไม่ระบุ ระบบจะใช้ราคาซื้อเป็นฐานประเมินในการคำนวณภาษี
                </span>
              </div>

              {/* Tax Usage Type Dropdown */}
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">ประเภทการใช้ประโยชน์ตามกฎหมาย *</label>
                <select
                  value={formData.taxUsageType || inferDefaultTaxUsage(formData.landType)}
                  onChange={(e) => setFormData({ ...formData, taxUsageType: e.target.value as LandTaxUsageType })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer font-medium"
                >
                  <option value="agricultural">เกษตรกรรม (0.01% - ยกเว้น 50 ล้านแรก)</option>
                  <option value="residential_primary">ที่อยู่อาศัยหลังหลัก (ยกเว้น 50 ล้านแรก)</option>
                  <option value="residential_other">ที่อยู่อาศัยหลังอื่น / ปล่อยเช่า (0.02% เริ่มต้น)</option>
                  <option value="commercial">พาณิชยกรรม / อื่นๆ (0.30% เริ่มต้น)</option>
                  <option value="vacant">ที่ดินรกร้างว่างเปล่า (0.30% + เพิ่มทุก 3 ปี)</option>
                </select>
              </div>

              {/* Individual Owner Checkbox */}
              <div className="sm:col-span-3 flex sm:flex-col justify-end">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={formData.isIndividualOwner !== false}
                    onChange={(e) => setFormData({ ...formData, isIndividualOwner: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-500 bg-slate-700 border-slate-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-slate-200 font-medium block">บุคคลธรรมดา</span>
                    <span className="text-[10px] text-slate-400 block">รับสิทธิยกเว้น 50 ล้าน</span>
                  </div>
                </label>
              </div>

              {/* Vacant consecutive years (only if vacant) */}
              {(formData.taxUsageType === 'vacant' || (!formData.taxUsageType && inferDefaultTaxUsage(formData.landType) === 'vacant')) && (
                <div className="sm:col-span-12 p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-rose-200">
                      ที่ดินทิ้งไว้ว่างเปล่าติดต่อกันกี่ปี? (มาตรา 43: รกร้างติดต่อกัน 3 ปีขึ้นไป อัตราภาษีจะเพิ่มขึ้น 0.3% ทุก 3 ปี)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={formData.vacantConsecutiveYears ?? 0}
                      onChange={(e) => setFormData({ ...formData, vacantConsecutiveYears: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-slate-100 font-mono text-xs"
                    />
                    <span className="text-slate-400 text-xs">ปี</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Calculation Output Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-rose-400" />
                    ภาษีที่ดินและสิ่งปลูกสร้างประมาณการต่อปี (Annual Land Tax):
                  </span>
                  {liveTaxResult.exemptionAmount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      ยกเว้น {formatCurrency(liveTaxResult.exemptionAmount)}
                    </span>
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white flex items-baseline gap-2">
                  {!liveTaxResult || liveTaxResult.annualTax === 0 ? (
                    <span className="text-emerald-400">0 ฿ / ปี</span>
                  ) : (
                    <span className="text-rose-300">{formatCurrency(liveTaxResult.annualTax)} / ปี</span>
                  )}
                  <span className="text-xs font-normal text-slate-400">
                    (เฉลี่ย {formatCurrency(liveTaxResult?.monthlyTax ?? 0)} / เดือน)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {liveTaxResult?.lawNote || ''} • ฐานภาษี: {formatCurrency(liveTaxResult?.taxableBase ?? 0)} • อัตราภาษีแท้จริง: {Number(liveTaxResult?.effectiveRatePercent || 0).toFixed(3)}%
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] text-slate-400">ประเภทตามแบบ ภ.ด.ส.</div>
                <div className="text-xs font-semibold text-slate-200 mt-0.5">
                  {(liveTaxResult && TAX_USAGE_CONFIGS[liveTaxResult.usageType]?.shortLabel) || 'ทั่วไป/รกร้าง'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Sales, Target Selling Price (KPI) & Status */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> 5. ประมาณการราคาขาย (KPI) และข้อมูลการขายจริง
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">สถานะปัจจุบัน</label>
                <select
                  value={formData.status || 'holding'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as LandStatus })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
                >
                  <option value="holding">ถือครอง (Holding)</option>
                  <option value="for_sale">กำลังประกาศขาย (For Sale)</option>
                  <option value="sold">ขายแล้ว (Sold)</option>
                  <option value="consignment">รับขายฝาก (Consignment)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">วันที่ซื้อ</label>
                <input
                  type="text"
                  placeholder="เช่น 23/3/2569"
                  value={formData.purchaseDate || ''}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">วันที่ขาย</label>
                <input
                  type="text"
                  placeholder="เช่น ขายแล้ว หรือ 18/2/2568"
                  value={formData.saleDate || ''}
                  onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-emerald-400 font-semibold mb-1">ราคาที่ตั้งใจจะขาย (KPI Target)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.targetSalePrice ?? 0}
                  onChange={(e) => setFormData({ ...formData, targetSalePrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-emerald-500/50 rounded-lg text-emerald-300 focus:outline-none focus:border-emerald-400 font-mono font-bold"
                />
              </div>
            </div>

            {/* Sales realization fields (if sold or partially sold) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs text-slate-400 mb-1">ราคาที่ขายได้จริง (Sold Price)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.soldPrice ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ soldPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">ค่าคอมมิชชั่นที่จ่าย (Commission)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.commissionFee ?? 0}
                  onChange={(e) => recalculateAreaAndPrices({ commissionFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">สุทธิที่ได้รับจริง (Net Received)</label>
                <input
                  type="number"
                  value={formData.netReceived ?? 0}
                  onChange={(e) => setFormData({ ...formData, netReceived: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Photo Upload & Attachments */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> 5. อัพโหลดรูปภาพโฉนด / รูปแปลงที่ดินจริง
              </h3>
              <label className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>เลือกรูปภาพอัพโหลด</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Uploaded Images Preview Gallery */}
            {formData.images && formData.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {formData.images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800 aspect-video"
                  >
                    <img
                      src={img.url}
                      alt={img.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end justify-between p-2">
                      <span className="text-[10px] text-slate-200 truncate max-w-[80%]">{img.title}</span>
                      <button
                        type="button"
                        onClick={() => handleImageDelete(img.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 bg-slate-900/80 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                ยังไม่มีรูปภาพที่อัพโหลด (รองรับรูปภาพโฉนด น.ส.4จ, รูปถ่ายระวาง, แผนที่ดาวเทียม, สัญญาจะซื้อจะขาย)
              </div>
            )}
          </div>

          {/* Section 6: Notes */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <label className="block text-xs text-slate-400 font-medium">หมายเหตุเพิ่มเติม</label>
            <textarea
              rows={3}
              placeholder="เช่น ขายไปแล้ว 3-0-54 ไร่, มีถนนคอนกรีตตัดผ่าน, ติดลำธาร, มีผู้เช่าทำสวน..."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Footer Save / Cancel / Delete Buttons */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-slate-900 py-3 z-10">
            <div>
              {initialData && initialData.id && onDelete && (
                <div>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      ลบแปลงนี้
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-rose-950/40 p-1.5 px-3 rounded-xl border border-rose-800/60">
                      <span className="text-xs text-rose-300 font-medium">ยืนยันลบแปลงนี้?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(initialData.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        ใช่, ลบเลย
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
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
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                title="พิมพ์ใบสรุปข้อมูลแปลงที่ดินนี้ (A4)"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>พิมพ์ใบสรุป</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {initialData ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลแปลงที่ดิน'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
