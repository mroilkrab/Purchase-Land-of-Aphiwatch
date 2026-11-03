import React, { useState, useRef } from 'react';
import { 
  HardDrive, 
  Download, 
  Upload, 
  FileJson, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  ArrowRight,
  Clock,
  Sparkles,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import { LandPlot, PortfolioSettings } from '../types/land';
import { exportToJsonFile, formatCurrency, formatThaiArea } from '../services/storage';

interface LocalBackupRestoreCardProps {
  plots: LandPlot[];
  settings: PortfolioSettings;
  onImportPlots: (plots: LandPlot[], settings?: PortfolioSettings) => void;
  onNavigateToTable?: () => void;
}

interface PendingRestore {
  plots: LandPlot[];
  settings?: PortfolioSettings;
  filename: string;
  exportDateThai?: string;
  exportTimestamp?: string;
  sourceVersion?: string;
  ownerName?: string;
  portfolioTitle?: string;
  totalCost?: number;
}

export const LocalBackupRestoreCard: React.FC<LocalBackupRestoreCardProps> = ({
  plots,
  settings,
  onImportPlots,
  onNavigateToTable,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackupInfo, setLastBackupInfo] = useState<{ filename: string; timestamp: string; count: number } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [isRestoring, setIsRestoring] = useState(false);

  // Calculate current portfolio stats
  const totalCostSum = plots.reduce((acc, p) => acc + (p.totalCost || 0), 0);
  const totalAreaSqWahSum = plots.reduce((acc, p) => acc + (p.totalSqWah || 0), 0);
  const totalDeedsCount = plots.reduce((acc, p) => acc + (p.subParcels?.length || 1), 0);
  const plotsWithImagesCount = plots.filter((p) => p.images && p.images.length > 0).length;

  // Handle explicit backup export
  const handleExplicitBackup = () => {
    try {
      const res = exportToJsonFile(plots, settings);
      const timeStr = new Date().toLocaleTimeString('th-TH');
      setLastBackupInfo({
        filename: res.filename,
        timestamp: `${new Date().toLocaleDateString('th-TH')} เวลา ${timeStr} น.`,
        count: res.totalPlots,
      });
      setFeedback({
        type: 'success',
        message: `สำรองข้อมูลสำเร็จ! บันทึกไฟล์ ${res.filename} (${res.totalPlots} แปลง) ลงในเครื่องคอมพิวเตอร์ของคุณแล้ว`,
      });
    } catch (err: any) {
      console.error('Backup error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์สำรอง',
      });
    }
  };

  // Handle file inspection for restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const parsed = JSON.parse(raw);

        let plotsFound: LandPlot[] = [];
        let settingsFound: PortfolioSettings | undefined = undefined;
        let exportDateThai: string | undefined = undefined;
        let exportTimestamp: string | undefined = undefined;
        let sourceVersion = '1.0';
        let ownerName: string | undefined = undefined;
        let portfolioTitle: string | undefined = undefined;
        let totalCost: number | undefined = undefined;

        if (parsed.plots && Array.isArray(parsed.plots)) {
          plotsFound = parsed.plots;
          settingsFound = parsed.settings;
          exportDateThai = parsed.exportDateThai;
          exportTimestamp = parsed.exportTimestamp || parsed.exportDate;
          sourceVersion = parsed.version || '2.0';
          ownerName = parsed.metadata?.ownerName || parsed.settings?.ownerName;
          portfolioTitle = parsed.metadata?.portfolioTitle || parsed.settings?.portfolioTitle;
          totalCost = parsed.metadata?.totalCost;
        } else if (Array.isArray(parsed)) {
          plotsFound = parsed;
          sourceVersion = '1.0 (Legacy)';
        } else {
          throw new Error('โครงสร้างไฟล์ JSON ไม่ถูกต้อง ไม่พบข้อมูลแปลงที่ดิน');
        }

        if (plotsFound.length === 0) {
          throw new Error('ไฟล์สำรองนี้ไม่มีรายการแปลงที่ดินอยู่เลย');
        }

        // Set pending confirmation
        setPendingRestore({
          plots: plotsFound,
          settings: settingsFound,
          filename: file.name,
          exportDateThai,
          exportTimestamp,
          sourceVersion,
          ownerName,
          portfolioTitle,
          totalCost,
        });

        setFeedback(null);
      } catch (err: any) {
        console.error('File parsing error:', err);
        setFeedback({
          type: 'error',
          message: `ไฟล์สำรองไม่ถูกต้อง: ${err.message || 'ไม่สามารถอ่านโครงสร้างข้อมูลได้'}`,
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Execute restore after user confirmation
  const executeRestore = () => {
    if (!pendingRestore) return;
    setIsRestoring(true);

    try {
      let finalPlots: LandPlot[] = [];
      if (restoreMode === 'overwrite') {
        finalPlots = pendingRestore.plots;
      } else {
        // Merge mode: keep existing plots, append missing plots by ID
        const existingIds = new Set(plots.map((p) => p.id));
        const newPlotsToAdd = pendingRestore.plots.filter((p) => !existingIds.has(p.id));
        finalPlots = [...plots, ...newPlotsToAdd];
      }

      // Re-apply to state and permanent storage
      onImportPlots(finalPlots, pendingRestore.settings);

      setFeedback({
        type: 'success',
        message: `🎉 กู้คืนข้อมูลสำเร็จ! คืนค่าแปลงที่ดิน ${finalPlots.length} รายการ และการตั้งค่าระบบเรียบร้อยแล้ว`,
      });

      setPendingRestore(null);
    } catch (err: any) {
      console.error('Restore execution error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-inner">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
              การสำรองและกู้คืนข้อมูลพอร์ตฉุกเฉิน (Explicit JSON Backup & Disaster Recovery)
            </h3>
            <p className="text-xs text-slate-400">
              สร้างไฟล์ Snapshot `.json` ทั้งระบบเก็บไว้ในเครื่องเพื่อป้องกันข้อมูลสูญหาย และนำกลับมากู้คืนได้ทันที 100%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✓ ข้อมูลในระบบปัจจุบัน: {plots.length} แปลง
          </span>
        </div>
      </div>

      {/* Current Portfolio Snapshot Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block font-medium">แปลงที่ดินทั้งหมด:</span>
          <span className="font-mono text-base font-bold text-white">{plots.length} แปลง</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">รวม {totalDeedsCount} โฉนด/แปลงย่อย</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block font-medium">เงินลงทุนรวม:</span>
          <span className="font-mono text-base font-bold text-amber-400">{formatCurrency(totalCostSum)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">ต้นทุนผูกพันทั้งหมด</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block font-medium">เนื้อที่รวม:</span>
          <span className="font-mono text-base font-bold text-emerald-400">{totalAreaSqWahSum.toLocaleString()} ตร.ว.</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">({(totalAreaSqWahSum / 400).toFixed(2)} ไร่)</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block font-medium">ความสมบูรณ์ของข้อมูล:</span>
          <span className="font-mono text-base font-bold text-cyan-400">{plotsWithImagesCount}/{plots.length} แปลง</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">มีรูปถ่ายโฉนดแนบ</span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-blue-400" />
            )}
            <span className="font-medium leading-relaxed">{feedback.message}</span>
          </div>

          {onNavigateToTable && feedback.type === 'success' && (
            <button
              type="button"
              onClick={onNavigateToTable}
              className="px-3 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span>เปิดดูตาราง</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main 2-Column Actions: Explicit Backup vs Explicit Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Box 1: Explicit Backup */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>1. ทำการสำรองข้อมูล (Explicit Backup)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              สร้างไฟล์ Snapshot ฉบับเต็ม (.JSON) รวมข้อมูลแปลงที่ดินทั้ง {plots.length} แปลง, ต้นทุน, โฉนดย่อย, เอกสารสิทธิ์, รูปภาพ และการตั้งค่าระบบ บันทึกลงในไดรฟ์เครื่องคอมพิวเตอร์ของคุณ
            </p>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">รูปแบบไฟล์:</span>
                <span className="font-mono text-emerald-400">JSON v2.0 UTF-8 Standard</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">สถานะล่าสุด:</span>
                <span className="text-slate-300">{lastBackupInfo?.timestamp || 'ยังไม่ได้สำรองในเซสชันนี้'}</span>
              </div>
              {lastBackupInfo && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ไฟล์ล่าสุด:</span>
                  <span className="font-mono text-xs text-teal-300 truncate max-w-[170px]" title={lastBackupInfo.filename}>
                    {lastBackupInfo.filename}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleExplicitBackup}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลดไฟล์สำรองฉุกเฉิน (.JSON)</span>
          </button>
        </div>

        {/* Box 2: Explicit Restore */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>2. กู้คืนพอร์ตจากไฟล์สำรอง (Disaster Recovery Restore)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              นำเข้าไฟล์สำรอง (.JSON) เพื่อกู้คืนพอร์ตที่ดินทั้งหมดกลับคืนมา 100% ในกรณีข้อมูลสูญหาย หรือเมื่อต้องการย้ายข้อมูลมาเครื่องใหม่
            </p>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>มีระบบตรวจสอบความถูกต้องก่อนกู้คืน:</span>
              </div>
              <p className="text-slate-400">
                ระบบจะตรวจสอบความถูกต้องของโครงสร้างไฟล์และแสดงหน้าจอยืนยันให้คุณเลือกวิธีแทนที่หรือรวมข้อมูลก่อนเริ่มกู้คืนเสมอ
              </p>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              id="explicit-json-restore-file"
            />
            <label
              htmlFor="explicit-json-restore-file"
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-400/50 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Upload className="w-4 h-4 text-blue-400" />
              <span>เลือกไฟล์สำรอง (.JSON) เพื่อกู้คืน</span>
            </label>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal Dialog (if pending) */}
      {pendingRestore && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-blue-950/50 border-2 border-blue-500/50 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-blue-500/30">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm sm:text-base">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>ยืนยันการกู้คืนข้อมูลพอร์ตจากไฟล์สำรอง</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
              {pendingRestore.filename}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">จำนวนแปลงที่พบ:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {pendingRestore.plots.length} แปลง
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">ชื่อพอร์ตที่สำรอง:</span>
              <span className="font-medium text-white truncate block">
                {pendingRestore.portfolioTitle || pendingRestore.ownerName || 'พอร์ตที่ดิน'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">วันที่สำรองข้อมูล:</span>
              <span className="text-slate-300 text-[11px]">
                {pendingRestore.exportDateThai || pendingRestore.exportTimestamp?.slice(0, 10) || '-'}
              </span>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-200">
              เลือกวิธีการกู้คืนข้อมูล:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRestoreMode('overwrite')}
                className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  restoreMode === 'overwrite'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-white flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${restoreMode === 'overwrite' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                    {restoreMode === 'overwrite' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>กู้คืนแทนที่ทั้งหมด (Full Restore & Overwrite)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-5">
                  ลบข้อมูลปัจจุบันในเครื่อง แล้วนำข้อมูลทั้ง {pendingRestore.plots.length} แปลงจากไฟล์สำรองมาใช้แทนที่ทันที (แนะนำสำหรับกู้คืน)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRestoreMode('merge')}
                className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  restoreMode === 'merge'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-200 ring-1 ring-blue-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-white flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${restoreMode === 'merge' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                    {restoreMode === 'merge' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>ผสานกับข้อมูลเดิม (Merge without duplicates)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-5">
                  เก็บข้อมูล {plots.length} แปลงเดิมไว้ และนำเฉพาะแปลงใหม่ที่ยังไม่มีเข้ามาเพิ่มต่อท้าย
                </p>
              </button>
            </div>
          </div>

          {/* Action Confirmation Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPendingRestore(null)}
              disabled={isRestoring}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={executeRestore}
              disabled={isRestoring}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังกู้คืนข้อมูล...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    ยืนยันการกู้คืน {restoreMode === 'overwrite' ? 'แทนที่ทั้งหมด' : 'แบบผสานข้อมูล'} ({pendingRestore.plots.length} แปลง)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
