import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  Settings, 
  Database, 
  FileSpreadsheet, 
  HardDrive, 
  Cloud, 
  RefreshCw, 
  Download, 
  Upload, 
  ShieldCheck, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Save, 
  Sparkles,
  Server,
  Key,
  Layers,
  HelpCircle
} from 'lucide-react';
import { PortfolioSettings, LandPlot } from '../types/land';
import { createGoogleSheet, updateExistingGoogleSheet } from '../services/googleSheets';
import { getAccessToken, syncToFirestore, loadFromFirestore } from '../services/firebaseAuth';
import { exportToJsonFile, exportToCsvFile } from '../services/storage';

interface SettingsAndBackupProps {
  settings: PortfolioSettings;
  onUpdateSettings: (settings: PortfolioSettings) => void;
  plots: LandPlot[];
  onResetData: () => void;
  onImportPlots: (plots: LandPlot[], settings?: PortfolioSettings) => void;
  user: User | null;
  onLoginGoogle: () => void;
}

export const SettingsAndBackup: React.FC<SettingsAndBackupProps> = ({
  settings,
  onUpdateSettings,
  plots,
  onResetData,
  onImportPlots,
  user,
  onLoginGoogle,
}) => {
  const [formData, setFormData] = useState<PortfolioSettings>(settings);
  const [existingSheetId, setExistingSheetId] = useState(settings.googleSheetId || '');
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetSuccessUrl, setSheetSuccessUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [firestoreSyncing, setFirestoreSyncing] = useState(false);
  const [firestoreSuccessMsg, setFirestoreSuccessMsg] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSaveSettingsSuccess(true);
    setTimeout(() => setSaveSettingsSuccess(false), 2500);
  };

  // Google Sheets Export (Create new)
  const handleExportToNewSheet = async () => {
    try {
      setSheetSyncing(true);
      setSheetError(null);
      setSheetSuccessUrl(null);

      const token = await getAccessToken();
      if (!token) {
        onLoginGoogle();
        setSheetSyncing(false);
        return;
      }

      const result = await createGoogleSheet(token, plots, formData);
      setSheetSuccessUrl(result.spreadsheetUrl);
      setExistingSheetId(result.spreadsheetId);
      onUpdateSettings({
        ...formData,
        googleSheetId: result.spreadsheetId,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Google Sheets export error:', err);
      setSheetError(err.message || 'ไม่สามารถส่งออกข้อมูลไปยัง Google Sheets ได้');
    } finally {
      setSheetSyncing(false);
    }
  };

  // Google Sheets Update (Existing ID)
  const handleUpdateExistingSheet = async () => {
    if (!existingSheetId.trim()) {
      alert('กรุณากรอก Google Spreadsheet ID');
      return;
    }

    try {
      setSheetSyncing(true);
      setSheetError(null);
      setSheetSuccessUrl(null);

      const token = await getAccessToken();
      if (!token) {
        onLoginGoogle();
        setSheetSyncing(false);
        return;
      }

      const result = await updateExistingGoogleSheet(token, existingSheetId.trim(), plots, formData);
      setSheetSuccessUrl(result.spreadsheetUrl);
      onUpdateSettings({
        ...formData,
        googleSheetId: result.spreadsheetId,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Google Sheets update error:', err);
      setSheetError(err.message || 'ไม่สามารถอัปเดต Google Sheet นี้ได้ ตรวจสอบสิทธิ์การเข้าถึง');
    } finally {
      setSheetSyncing(false);
    }
  };

  // Firestore Cloud Backup
  const handleSyncFirestore = async () => {
    try {
      setFirestoreSyncing(true);
      setFirestoreError(null);
      setFirestoreSuccessMsg(null);

      const userId = user?.uid || 'apiwat_portfolio_shared';
      const res = await syncToFirestore(userId, plots, formData);
      setFirestoreSuccessMsg(`สำรองข้อมูลขึ้น Firebase Firestore สำเร็จแล้ว เมื่อ ${res.timestamp}`);
    } catch (err: any) {
      console.error('Firestore sync error:', err);
      setFirestoreError(err.message || 'ไม่สามารถสำรองข้อมูลขึ้น Firestore ได้');
    } finally {
      setFirestoreSyncing(false);
    }
  };

  const handleRestoreFirestore = async () => {
    if (!window.confirm('ต้องการโหลดข้อมูลจาก Firebase Firestore มาเขียนทับข้อมูลในเครื่องหรือไม่?')) {
      return;
    }
    try {
      setFirestoreSyncing(true);
      setFirestoreError(null);
      const userId = user?.uid || 'apiwat_portfolio_shared';
      const data = await loadFromFirestore(userId);
      if (data && data.plots && data.plots.length > 0) {
        onImportPlots(data.plots, data.settings);
        setFirestoreSuccessMsg(`โหลดข้อมูลจาก Firestore สำเร็จ (${data.plots.length} แปลง)`);
      } else {
        setFirestoreError('ยังไม่มีข้อมูลที่สำรองไว้ใน Firestore สำหรับผู้ใช้นี้');
      }
    } catch (err: any) {
      console.error('Firestore restore error:', err);
      setFirestoreError(err.message || 'ไม่สามารถโหลดข้อมูลจาก Firestore ได้');
    } finally {
      setFirestoreSyncing(false);
    }
  };

  // JSON Import
  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.plots && Array.isArray(parsed.plots)) {
          onImportPlots(parsed.plots, parsed.settings);
          alert(`นำเข้าข้อมูลสำเร็จ ${parsed.plots.length} รายการ!`);
        } else if (Array.isArray(parsed)) {
          onImportPlots(parsed);
          alert(`นำเข้าข้อมูลสำเร็จ ${parsed.length} รายการ!`);
        } else {
          alert('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <Database className="w-3.5 h-3.5" /> Hybrid Backup & Cloud Architecture
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              การตั้งค่าระบบและศูนย์สำรองข้อมูลแบบไฮบริด (Hybrid Storage)
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              จัดการข้อมูลเริ่มต้น ซิงค์ตาราง Google Sheets, บันทึก Local Storage, และเชื่อมต่อ Cloud Database (Firebase / Supabase)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column 1: System Settings Form */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              การตั้งค่าข้อมูลระบบ (General Settings)
            </h3>
            <button
              onClick={() => {
                if (window.confirm('ต้องการคืนค่าข้อมูลเริ่มต้นตามตาราง 10 แปลงของคุณอภิวัชร์หรือไม่?')) {
                  onResetData();
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> คืนค่าข้อมูลเริ่มต้น (Reset Default)
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-xs text-slate-400 mb-1">ชื่อเจ้าของพอร์ตที่ดิน</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">ชื่อหัวข้อพอร์ตโฟลิโอ (Title)</label>
              <input
                type="text"
                value={formData.portfolioTitle}
                onChange={(e) => setFormData({ ...formData, portfolioTitle: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">อัตราค่าคอมมิชชั่นมาตรฐาน (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.defaultCommissionRate}
                  onChange={(e) => setFormData({ ...formData, defaultCommissionRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">อัตราภาษี/ค่าโอนประมาณการ (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.defaultTaxRate}
                  onChange={(e) => setFormData({ ...formData, defaultTaxRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {saveSettingsSuccess ? (
                  <>
                    <Check className="w-4 h-4" /> บันทึกการตั้งค่าเรียบร้อยแล้ว
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> บันทึกการตั้งค่า
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Local Storage & File Backup Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-400" />
              การสำรองข้อมูลในเครื่อง (Local Storage & Offline Files)
            </h4>
            <p className="text-xs text-slate-400">
              ระบบบันทึกลง Local Storage ในเบราว์เซอร์อัตโนมัติทุกครั้งที่มีการแก้ไข และสามารถดาวน์โหลดไฟล์เก็บไว้สำรองได้
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => exportToJsonFile(plots, formData)}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                ดาวน์โหลด JSON Backup
              </button>

              <button
                type="button"
                onClick={() => exportToCsvFile(plots, formData)}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                ส่งออกตาราง CSV
              </button>
            </div>

            <div className="pt-1">
              <label className="w-full p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-dashed border-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>นำเข้าไฟล์สำรอง (Restore from JSON Backup)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column 2: Google Sheets & Cloud Sync */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              การจัดเก็บข้อมูลใน Google Sheets
            </h3>
            {user ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Google เชื่อมต่อแล้ว
              </span>
            ) : (
              <button
                onClick={onLoginGoogle}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                เข้าสู่ระบบ Google เพื่อเปิดใช้งาน
              </button>
            )}
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            <p className="text-xs text-slate-300">
              จัดเก็บข้อมูลเพิ่มเข้าไปใน Google Sheets แบบ Real-time จัดรูปแบบหัวตารางภาษาไทย สูตรคำนวณต้นทุน และขนาดที่ดิน ไร่-งาน-วา ครบถ้วน
            </p>

            {/* Actions for Google Sheets */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleExportToNewSheet}
                disabled={sheetSyncing}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {sheetSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> กำลังซิงค์ข้อมูลกับ Google Sheets...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" /> สร้างและส่งออก Google Sheet ใหม่ทันที
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-xs text-slate-400">
                  หรือซิงค์อัพเดตเข้ากับ Google Spreadsheet ID ที่มีอยู่เดิม:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="เช่น 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={existingSheetId}
                    onChange={(e) => setExistingSheetId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateExistingSheet}
                    disabled={sheetSyncing}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                  >
                    อัปเดต Sheet
                  </button>
                </div>
              </div>

              {/* Status / Link Box */}
              {sheetSuccessUrl && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>ซิงค์ข้อมูลลงใน Google Sheet เรียบร้อยแล้ว!</span>
                  </div>
                  <a
                    href={sheetSuccessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
                  >
                    เปิดดูใน Google Sheets <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {sheetError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{sheetError}</span>
                </div>
              )}
            </div>

            {/* Firebase Firestore Cloud Database Section */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  การสำรองข้อมูลบน Firebase Firestore Cloud
                </h4>
                <span className="text-[11px] text-emerald-400 font-mono">พร้อมใช้งาน</span>
              </div>
              <p className="text-xs text-slate-400">
                ระบบเชื่อมต่อกับ Firestore Database เพื่อจัดเก็บข้อมูลบน Google Cloud อย่างปลอดภัย เข้าถึงได้จากทุกอุปกรณ์
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSyncFirestore}
                  disabled={firestoreSyncing}
                  className="p-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {firestoreSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                  ซิงค์ขึ้น Firestore Cloud
                </button>

                <button
                  type="button"
                  onClick={handleRestoreFirestore}
                  disabled={firestoreSyncing}
                  className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  โหลดจาก Firestore
                </button>
              </div>

              {firestoreSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-3.5 h-3.5" />
                  {firestoreSuccessMsg}
                </div>
              )}

              {firestoreError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {firestoreError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Backup & Architecture Advisor (Comprehensive Guide requested by user) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              คำแนะนำสถาปัตยกรรมคลาวด์และการสำรองข้อมูล (Cloud Backup & Architecture Advisory)
            </h3>
            <p className="text-xs text-slate-400">
              ตอบคำถาม: &quot;ต้องมีอะไรเพิ่มเติมเข้าไป และสำรองข้อมูลไว้ที่ไหนได้อีกแบบไม่ยุ่งยาก เพื่อความปลอดภัยและการวิเคราะห์&quot;
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card 1: Local Storage + Google Sheets */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4" /> 1. Google Sheets + Local
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                เปิดใช้งานแล้ว
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>ข้อดี:</strong> ใช้งานง่ายที่สุด ไม่ต้องตั้งค่า Database เพิ่ม, นำไปต่อยอดทำ Dashboard ใน Looker Studio ได้ทันที, แชร์ให้ทีมงานเปิดในมือถือหรือ Excel ได้สะดวก
            </p>
            <div className="text-slate-400 text-[11px]">
              • <strong>ความเหมาะสม:</strong> บันทึกดีลการซื้อขาย ส่งให้สำนักงานบัญชี และรายงานสรุป
            </div>
          </div>

          {/* Card 2: Firebase Firestore */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-400 text-sm flex items-center gap-1.5">
                <Cloud className="w-4 h-4" /> 2. Firebase Firestore
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                เชื่อมต่อพร้อมใช้งาน
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>ข้อดี:</strong> Real-time Database ระดับองค์กรของ Google, มี Security Rules ป้องกันการเข้าถึง, รองรับ Offline Persistence อัตโนมัติ, ฟรี 50,000 Reads/วัน ไม่เสียค่าบริการ
            </p>
            <div className="text-slate-400 text-[11px]">
              • <strong>ความเหมาะสม:</strong> ซิงค์ข้อมูลระหว่างคอมพิวเตอร์และมือถือแบบอัตโนมัติ
            </div>
          </div>

          {/* Card 3: Supabase (PostgreSQL) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-teal-400 text-sm flex items-center gap-1.5">
                <Database className="w-4 h-4" /> 3. Supabase (Postgres)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20">
                ตัวเลือกแนะนำเสริม
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>ข้อดี:</strong> Relational Database (SQL) แท้ รองรับ PostGIS (การวิเคราะห์แผนที่เชิงพื้นที่ Polygon ที่ดิน), Row Level Security (RLS) ที่ปลอดภัยสูงสุด
            </p>
            <div className="text-slate-400 text-[11px]">
              • <strong>ความเหมาะสม:</strong> เมื่อพอร์ตขยายใหญ่เกิน 500 แปลง หรือต้องการวาดแนวเขตที่ดินพิกัด GIS
            </div>
          </div>
        </div>

        {/* Actionable Recommendations Checklist */}
        <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
          <h4 className="font-semibold text-slate-200 text-xs sm:text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            สิ่งที่แนะนำให้จัดเก็บเพิ่มเติม เพื่อความปลอดภัยและวิเคราะห์ได้อย่างสมบูรณ์:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong>รูปภาพโฉนดด้านหน้า-ด้านหลัง (น.ส.4จ / ระวาง):</strong> อัพโหลดเก็บไว้ในระบบและเชื่อมกับ Google Drive เพื่อเปิดดูได้ทันทีเมื่อต้องทำธุรกรรมที่สำนักงานที่ดิน
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong>ราคาประเมินทุนทรัพย์กรมธนารักษ์:</strong> แนะนำให้กรอกราคาประเมินราชการควบคู่กับราคาซื้อขายจริง เพื่อคำนวณภาษีหัก ณ ที่จ่าย และค่าธรรมเนียมโอนได้อย่างแม่นยำ 100%
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong>ประวัติสัญญาจะซื้อจะขายและมัดจำ:</strong> จัดเก็บวันที่วางเงินมัดจำ งวดการชำระเงิน และวันนัดโอนกรรมสิทธิ์ เพื่อแจ้งเตือน KPI กำหนดการขาย
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong>ระบบ Hybrid สำรอง 3 ชั้น (3-2-1 Backup Rule):</strong> ชั้นที่ 1 บันทึกใน Local Storage (ทำงานได้แม้ไม่มีเน็ต) + ชั้นที่ 2 ซิงค์ Google Sheets + ชั้นที่ 3 คลาวด์ Firebase / Firestore
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
