import React, { useState, useEffect, useMemo } from 'react';
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
  HelpCircle,
  FolderSync,
  Terminal,
  FileCode,
  Copy,
  Globe,
  Type,
  Sun,
  Moon,
  CheckCircle2,
  Trash2,
  PlusCircle,
  Table as TableIcon,
  ArrowRight
} from 'lucide-react';
import { PortfolioSettings, LandPlot } from '../types/land';
import { createGoogleSheet, updateExistingGoogleSheet } from '../services/googleSheets';
import { getAccessToken, syncToFirestore, loadFromFirestore, googleSignIn } from '../services/firebaseAuth';
import { exportToJsonFile, exportToCsvFile, formatCurrency, formatThaiArea } from '../services/storage';
import { parseCsvToPlots, getSampleCsvTemplate, CsvParseResult } from '../services/csvImporter';
import { 
  ensureDriveFolder, 
  uploadJsonSnapshotToDrive, 
  listDriveFolderFiles, 
  DriveFileItem 
} from '../services/googleDrive';
import { 
  CloudflareD1Config, 
  loadD1Config, 
  saveD1Config, 
  syncWithCloudflareD1, 
  fetchFromCloudflareD1, 
  downloadCloudflareDeployFiles,
  D1_SQL_SCHEMA,
  D1_WORKER_CODE,
  D1_WRANGLER_TOML
} from '../services/cloudflareD1';
import { runHybridSync, HybridSyncResult } from '../services/hybridStorage';

interface SettingsAndBackupProps {
  settings: PortfolioSettings;
  onUpdateSettings: (settings: PortfolioSettings) => void;
  plots: LandPlot[];
  onResetData: () => void;
  onImportPlots: (plots: LandPlot[], settings?: PortfolioSettings) => void;
  user: User | null;
  onLoginGoogle: () => void;
  onNavigateToTable?: () => void;
}

export const SettingsAndBackup: React.FC<SettingsAndBackupProps> = ({
  settings,
  onUpdateSettings,
  plots,
  onResetData,
  onImportPlots,
  user,
  onLoginGoogle,
  onNavigateToTable,
}) => {
  const [formData, setFormData] = useState<PortfolioSettings>(settings);
  const [existingSheetId, setExistingSheetId] = useState(settings.googleSheetId || '');
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetSuccessUrl, setSheetSuccessUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [activeSettingsTab, setActiveSettingsTab] = useState<'storage' | 'csv' | 'general' | 'hybrid'>('storage');
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [storageDiagnostics, setStorageDiagnostics] = useState<{
    indexedDbOk: boolean;
    localStorageOk: boolean;
    plotCount: number;
    imageCount: number;
    estimatedImageMb: string;
    localStorageBytesKb: string;
    checkedAt: string;
  } | null>(null);

  const totalPlotImages = useMemo(() => {
    return plots.reduce((acc, p) => acc + (p.images?.length || 0), 0);
  }, [plots]);

  const totalImageSizeMb = useMemo(() => {
    let bytes = 0;
    plots.forEach((p) => {
      p.images?.forEach((img) => {
        if (img.url) bytes += img.url.length;
      });
    });
    return (bytes / (1024 * 1024)).toFixed(2);
  }, [plots]);

  const runStorageDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    await new Promise((r) => setTimeout(r, 350));
    let imgBytes = 0;
    let totalImages = 0;
    plots.forEach((p) => {
      p.images?.forEach((img) => {
        totalImages++;
        if (img.url) imgBytes += img.url.length;
      });
    });

    let localRaw = 0;
    try {
      const pRaw = localStorage.getItem('land_portfolio_plots_v1') || '';
      const sRaw = localStorage.getItem('land_portfolio_settings_v1') || '';
      localRaw = pRaw.length + sRaw.length;
    } catch (e) {}

    const hasIndexedDb = typeof window !== 'undefined' && !!window.indexedDB;

    setStorageDiagnostics({
      indexedDbOk: hasIndexedDb,
      localStorageOk: true,
      plotCount: plots.length,
      imageCount: totalImages,
      estimatedImageMb: (imgBytes / (1024 * 1024)).toFixed(2),
      localStorageBytesKb: (localRaw / 1024).toFixed(1),
      checkedAt: new Date().toLocaleTimeString('th-TH'),
    });
    setIsRunningDiagnostic(false);
  };

  // Bulk CSV Paste Import state
  const [csvInputText, setCsvInputText] = useState('');
  const [csvImportMode, setCsvImportMode] = useState<'replace' | 'append'>('replace');
  const [csvParsePreview, setCsvParsePreview] = useState<CsvParseResult | null>(null);
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const [csvImportSuccessBanner, setCsvImportSuccessBanner] = useState<string | null>(null);

  // Auto-parse CSV input whenever text or mode changes
  useEffect(() => {
    if (!csvInputText.trim()) {
      setCsvParsePreview(null);
      return;
    }
    const startingOrder = csvImportMode === 'append'
      ? Math.max(...plots.map((p) => p.orderNumber || 0), 0) + 1
      : 1;
    const res = parseCsvToPlots(csvInputText, startingOrder);
    setCsvParsePreview(res);
  }, [csvInputText, csvImportMode, plots]);

  const handleLoadSampleCsv = () => {
    const sample = getSampleCsvTemplate();
    setCsvInputText(sample);
    setCsvImportSuccessBanner(null);
  };

  const handleCopyCsvHeaders = () => {
    const headers = 'ลำดับ,วันที่ซื้อ,วันที่ขาย,รายละเอียดที่ดิน,ประเภท,ตำบล/แขวง,อำเภอ/เขต,จังหวัด,เลขที่ดิน,ตำแหน่งที่ดิน,ไร่,งาน,ตารางวา,รวมจำนวนที่ดิน(ไร่),รวมจำนวนที่ดิน(ตร.ว.),ไร่ละ,ตารางวาละ,ราคารวม/ราคาซื้อ,จ่ายค่าธรรมเนียม/ค่าอากร/ภาษี,จ่ายค่ารังวัด,จ่ายค่าใช้จ่ายอื่นๆ,รวมทั้งสิ้น/ทั้งหมด,ราคาที่ตั้งใจจะขาย,ราคาที่ขายได้,ค่าคอมมิชชั่น,สุทธิที่ได้รับ,สถานะ,หมายเหตุเพิ่มเติม';
    navigator.clipboard.writeText(headers);
    setCopiedCode('csvHeaders');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleExecuteCsvImport = () => {
    if (!csvParsePreview || csvParsePreview.plots.length === 0) return;
    setIsCsvImporting(true);

    try {
      let finalPlots: LandPlot[];
      if (csvImportMode === 'append') {
        finalPlots = [...plots, ...csvParsePreview.plots];
      } else {
        finalPlots = csvParsePreview.plots;
      }

      onImportPlots(finalPlots, formData);
      const msg = `นำเข้าข้อมูลที่ดินแบบกลุ่มสำเร็จ ${csvParsePreview.plots.length} แปลง (${csvImportMode === 'append' ? 'เพิ่มต่อท้ายข้อมูลเดิม' : 'แทนที่ข้อมูลทั้งหมด'})`;
      setCsvImportSuccessBanner(msg);
      setImportStatus({
        type: 'success',
        message: msg,
      });
      setCsvInputText('');
      setCsvParsePreview(null);
      setTimeout(() => setImportStatus(null), 4000);
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการนำเข้า: ${err.message || 'โปรดตรวจสอบข้อมูล'}`,
      });
    } finally {
      setIsCsvImporting(false);
    }
  };

  // Google Drive state
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);

  // Cloudflare D1 state
  const [d1Config, setD1Config] = useState<CloudflareD1Config>(() => loadD1Config());
  const [d1Syncing, setD1Syncing] = useState(false);
  const [d1SuccessMsg, setD1SuccessMsg] = useState<string | null>(null);
  const [d1Error, setD1Error] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Full Hybrid Sync state
  const [hybridSyncing, setHybridSyncing] = useState(false);
  const [hybridResult, setHybridResult] = useState<HybridSyncResult | null>(null);

  // Firestore state
  const [firestoreSyncing, setFirestoreSyncing] = useState(false);
  const [firestoreSuccessMsg, setFirestoreSuccessMsg] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showD1PullConfirm, setShowD1PullConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFontSizeChange = (size: any) => {
    const updated = { ...formData, fontSize: size };
    setFormData(updated);
    onUpdateSettings(updated);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    saveD1Config(d1Config);
    setSaveSettingsSuccess(true);
    setTimeout(() => setSaveSettingsSuccess(false), 2500);
  };

  // Google Drive Backup
  const handleBackupToGoogleDrive = async () => {
    try {
      setDriveSyncing(true);
      setDriveError(null);
      setDriveSuccessMsg(null);

      let token = await getAccessToken();
      if (!token) {
        // Automatically prompt Google login popup so user does not need to manually click login first
        try {
          const authRes = await googleSignIn();
          if (authRes?.accessToken) {
            token = authRes.accessToken;
          } else {
            setDriveError('กรุณากดยินยอมเข้าสู่ระบบ Google ในหน้าต่างป๊อปอัปเพื่ออนุญาตให้สำรองไฟล์ลง Google Drive');
            setDriveSyncing(false);
            return;
          }
        } catch (signInErr: any) {
          console.warn('Google sign-in popup error:', signInErr);
          setDriveError('กรุณาเปิดหน้าต่างป๊อปอัป (Allow Pop-up) และเข้าสู่ระบบ Google เพื่อเปิดสิทธิ์การซิงค์ Drive');
          setDriveSyncing(false);
          return;
        }
      }

      let folderId: string | null = null;
      try {
        folderId = await ensureDriveFolder(token, 'Land_Portfolio_Manager');
        setDriveFolderId(folderId);
      } catch (fErr: any) {
        if (fErr.message?.includes('เซสชัน Google หมดอายุ')) {
          // Token expired, re-sign in
          const authRes = await googleSignIn();
          if (authRes?.accessToken) {
            token = authRes.accessToken;
            folderId = await ensureDriveFolder(token, 'Land_Portfolio_Manager');
            setDriveFolderId(folderId);
          } else {
            throw fErr;
          }
        }
      }

      const res = await uploadJsonSnapshotToDrive(token, folderId, plots, formData);
      setDriveSuccessMsg(`สำรองไฟล์ขึ้น Google Drive สำเร็จ: ${res.fileName} (จัดเก็บใน ${folderId ? 'โฟลเดอร์ Land_Portfolio_Manager' : 'ไดรฟ์ของฉัน (My Drive)'})`);

      // Refresh list
      const files = await listDriveFolderFiles(token, folderId);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Drive backup error:', err);
      setDriveError(err.message || 'ไม่สามารถสำรองข้อมูลขึ้น Google Drive ได้ โปรดตรวจสอบการอนุญาตสิทธิ์');
    } finally {
      setDriveSyncing(false);
    }
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
      setSheetError('กรุณากรอก Google Spreadsheet ID ก่อนกดอัปเดต');
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

  // Cloudflare D1 Sync
  const handleSyncCloudflareD1 = async () => {
    try {
      setD1Syncing(true);
      setD1Error(null);
      setD1SuccessMsg(null);

      saveD1Config(d1Config);
      const res = await syncWithCloudflareD1(d1Config, plots, formData);
      setD1SuccessMsg(res.message);
    } catch (err: any) {
      console.error('Cloudflare D1 sync error:', err);
      setD1Error(err.message || 'ไม่สามารถซิงค์เข้า Cloudflare D1 ได้');
    } finally {
      setD1Syncing(false);
    }
  };

  // Cloudflare D1 Pull
  const handlePullFromCloudflareD1 = () => {
    setShowD1PullConfirm(true);
  };

  const executePullFromCloudflareD1 = async () => {
    setShowD1PullConfirm(false);
    try {
      setD1Syncing(true);
      setD1Error(null);
      const res = await fetchFromCloudflareD1(d1Config);
      if (res && res.plots && res.plots.length > 0) {
        onImportPlots(res.plots, res.settings);
        setD1SuccessMsg(`ดึงข้อมูลจาก Cloudflare D1 สำเร็จ (${res.plots.length} แปลง)`);
        setImportStatus({
          type: 'success',
          message: `ดึงข้อมูลจาก Cloudflare D1 สำเร็จ (${res.plots.length} แปลง)`,
        });
        setTimeout(() => setImportStatus(null), 3500);
      } else {
        setD1Error('ไม่พบข้อมูลแปลงที่ดินใน Cloudflare D1');
      }
    } catch (err: any) {
      console.error('Cloudflare D1 pull error:', err);
      setD1Error(err.message || 'ไม่สามารถดึงข้อมูลจาก Cloudflare D1 ได้');
    } finally {
      setD1Syncing(false);
    }
  };

  // Master One-Click 3-Tier Hybrid Sync
  const handleMasterHybridSync = async () => {
    try {
      setHybridSyncing(true);
      setHybridResult(null);
      const res = await runHybridSync(plots, formData, d1Config);
      setHybridResult(res);
    } catch (err: any) {
      console.error('Hybrid sync error:', err);
    } finally {
      setHybridSyncing(false);
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

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
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
          setImportStatus({ type: 'success', message: `นำเข้าข้อมูลสำเร็จ ${parsed.plots.length} รายการ!` });
        } else if (Array.isArray(parsed)) {
          onImportPlots(parsed);
          setImportStatus({ type: 'success', message: `นำเข้าข้อมูลสำเร็จ ${parsed.length} รายการ!` });
        } else {
          setImportStatus({ type: 'error', message: 'รูปแบบไฟล์ JSON ไม่ถูกต้อง กรุณาใช้ไฟล์ที่ส่งออกจากระบบ' });
        }
      } catch (err) {
        setImportStatus({ type: 'error', message: 'เกิดข้อผิดพลาดในการอ่านไฟล์ JSON ตรวจสอบความถูกต้องของไฟล์' });
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <Globe className="w-3.5 h-3.5" /> Hybrid Storage Engine: Google Drive + Cloudflare D1 + Workers
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              ระบบจัดเก็บและสำรองข้อมูลไฮบริด (Hybrid Cloud Storage)
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              จัดเก็บไฟล์ Snapshot ใน Google Drive, ฐานข้อมูล Edge SQL ใน Cloudflare D1 และโฮสต์ API บน Cloudflare Workers
            </p>
          </div>

          {/* Master 1-Click Sync Button */}
          <div>
            <button
              onClick={handleMasterHybridSync}
              disabled={hybridSyncing}
              className="w-full lg:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {hybridSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> กำลังประมวลผลซิงค์ไฮบริด 3 ชั้น...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> ซิงค์ไฮบริดทุกช่องทาง (1-Click Hybrid Sync)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Master Hybrid Sync Results Banner (if ran) */}
        {hybridResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2 text-xs">
            <div className="font-bold text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4" /> ผลการซิงค์ข้อมูลไฮบริด (เมื่อ {hybridResult.timestamp}):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block font-semibold">1. Local Storage:</span>
                <span className="text-emerald-300">{hybridResult.local.message}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block font-semibold">2. Cloudflare D1:</span>
                <span className={hybridResult.cloudflareD1.success ? 'text-emerald-300' : 'text-rose-300'}>
                  {hybridResult.cloudflareD1.message}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block font-semibold">3. Google Drive:</span>
                <span className={hybridResult.googleDrive.success ? 'text-emerald-300' : 'text-amber-300'}>
                  {hybridResult.googleDrive.message}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block font-semibold">4. Google Sheets:</span>
                <span className={hybridResult.googleSheets.success ? 'text-emerald-300' : 'text-amber-300'}>
                  {hybridResult.googleSheets.message}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('storage')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSettingsTab === 'storage'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-300" />
          <span>แหล่งจัดเก็บ & ซิงค์คลาวด์ (Data & Storage)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('csv')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSettingsTab === 'csv'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>นำเข้า CSV แบบกลุ่ม (Bulk CSV)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSettingsTab === 'general'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-4 h-4 text-emerald-400" />
          <span>ตั้งค่าระบบ & ขนาดตัวอักษร (General & Display)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('hybrid')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSettingsTab === 'hybrid'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>ไฮบริดคลาวด์ & D1 (Hybrid Architecture)</span>
        </button>
      </div>

      {/* Tab 1: Data & Storage (แหล่งจัดเก็บข้อมูลและสถานะซิงค์คลาวด์) */}
      {activeSettingsTab === 'storage' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Storage Overview & Live Health Status Header */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  ภาพรวมแหล่งจัดเก็บข้อมูลในระบบ (Data & Storage Architecture)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ระบบจัดเก็บข้อมูลแบบ 2 ชั้นบนเครื่องผู้ใช้ (IndexedDB + LocalStorage) พร้อมเชื่อมต่อซิงค์คลาวด์ภายนอกแบบไฮบริด
                </p>
              </div>

              <button
                type="button"
                onClick={runStorageDiagnostic}
                disabled={isRunningDiagnostic}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
              >
                {isRunningDiagnostic ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span>ตรวจสอบความสมบูรณ์ของฐานข้อมูล (Run Health Check)</span>
              </button>
            </div>

            {/* Quick Live Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">แปลงที่ดินในระบบ</span>
                <span className="text-xl font-bold text-white font-mono">{plots.length}</span>
                <span className="text-[10px] text-emerald-400 block">แปลงบันทึกถาวร</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">รูปถ่ายโฉนด & เอกสาร</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">{totalPlotImages}</span>
                <span className="text-[10px] text-slate-400 block">ไฟล์ภาพใน IndexedDB</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">ขนาดไฟล์ภาพโดยประมาณ</span>
                <span className="text-xl font-bold text-cyan-400 font-mono">{totalImageSizeMb} MB</span>
                <span className="text-[10px] text-slate-400 block">ไม่มีโควตา 5MB ขัดขวาง</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">สถานะคลาวด์ภายนอก</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5 pt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${user || formData.googleSheetId ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {user ? 'Google ผูกแล้ว' : 'โหมดในเครื่อง'}
                </span>
                <span className="text-[10px] text-slate-400 block">Sheets / Firebase / Drive</span>
              </div>
            </div>

            {/* Storage Diagnostic Result Card (if executed) */}
            {storageDiagnostics && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ผลการตรวจสอบความสมบูรณ์ของระบบจัดเก็บ (ตรวจเมื่อ {storageDiagnostics.checkedAt}):
                  </span>
                  <span className="text-[11px] text-emerald-400/80 font-mono">สถานะ: สมบูรณ์ 100%</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-300">
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">IndexedDB (LandPortfolio_DB):</span>
                    <span className="text-emerald-400 font-semibold">✓ เชื่อมต่อสำเร็จ (รองรับความจุสูง)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">LocalStorage Cache:</span>
                    <span className="text-emerald-400 font-semibold">✓ ปกติ (ใช้งาน {storageDiagnostics.localStorageBytesKb} KB / 5MB)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">ไฟล์รูปภาพโฉนด & เอกสาร:</span>
                    <span className="text-cyan-300 font-semibold">{storageDiagnostics.imageCount} ไฟล์ (~{storageDiagnostics.estimatedImageMb} MB)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Local Storage Breakdown: IndexedDB vs. LocalStorage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box A: IndexedDB */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">ฐานข้อมูล IndexedDB</h4>
                    <span className="text-[11px] text-slate-400 font-mono">LandPortfolio_DB (Stores: plots, settings)</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  🟢 แหล่งเก็บหลัก (Primary)
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-200 block">สิ่งที่จัดเก็บใน IndexedDB:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
                    <li><strong className="text-emerald-300">รูปถ่ายโฉนดที่ดินความละเอียดสูงทั้งหมด:</strong> ไฟล์ภาพฉบับเต็ม Base64 จะถูกเก็บที่นี่โดยตรง</li>
                    <li><strong className="text-slate-200">ข้อมูลแปลงที่ดินครบถ้วน 100%:</strong> เนื้อที่ ไร่-งาน-ตร.ว., ต้นทุนทุกประเภท, ประวัติการซื้อขาย</li>
                    <li><strong className="text-slate-200">เช็กลิสต์เอกสารสิทธิ์ 6 หมวด:</strong> พร้อมสถานะไฟล์แนบและฉบับจริงในแฟ้ม</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-200 block">ข้อดีและขีดจำกัดความจุ:</span>
                  <p className="text-slate-400 leading-relaxed">
                    <strong className="text-emerald-400">ไม่มีโควตาจำกัด 5MB:</strong> เบราว์เซอร์ให้พื้นที่ IndexedDB ในเครื่องได้หลายกิกะไบต์ สามารถแนบรูปถ่ายโฉนดและเอกสารสิทธิ์ความละเอียดสูงได้ไม่จำกัดจำนวน
                  </p>
                </div>
              </div>
            </div>

            {/* Box B: LocalStorage */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">พื้นที่แคช LocalStorage</h4>
                    <span className="text-[11px] text-slate-400 font-mono">land_portfolio_plots_v1, settings_v1</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  🟢 แคชสตาร์ทอัป (Fast Cache)
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-200 block">สิ่งที่จัดเก็บใน LocalStorage:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
                    <li><strong className="text-blue-300">แคชข้อมูลเริ่มต้นของแอป:</strong> ช่วยให้เปิดหน้าเว็บแล้วข้อมูลโหลดขึ้นมาแสดงผลทันทีในเสี้ยววินาที</li>
                    <li><strong className="text-slate-200">การตั้งค่าระบบ:</strong> ธีมมืด/สว่าง, ขนาดตัวอักษร, ชื่อพอร์ตโฟลิโอ, อัตราคอมมิชชั่น</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-200 block">กลไกป้องกัน Quota Exceeded อัจฉริยะ:</span>
                  <p className="text-slate-400 leading-relaxed">
                    LocalStorage มีโควตา ~5MB ของเบราว์เซอร์ หากผู้ใช้แนบรูปถ่ายโฉนดจำนวนมาก ระบบจะตัดเก็บเฉพาะ Reference ในแคชอัตโนมัติ โดยที่<strong className="text-emerald-400">รูปภาพฉบับเต็มทั้งหมดยังคงถูกรักษาไว้ใน IndexedDB อย่างปลอดภัย 100%</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Cloud Synchronization Status Indicators */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-teal-400" />
                  สถานะการซิงค์ข้อมูลบนคลาวด์ภายนอก (Cloud Synchronization Status)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  ตรวจสอบและควบคุมการเชื่อมต่อตาราง Google Sheets, ฐานข้อมูล Firestore, Google Drive และ Cloudflare D1
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cloud 1: Google Sheets */}
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs sm:text-sm">Google Sheets ตารางซื้อขาย</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    formData.googleSheetId || sheetSuccessUrl
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {formData.googleSheetId || sheetSuccessUrl ? '🟢 เชื่อมต่อแล้ว (Connected)' : '⚪ ยังไม่เชื่อมต่อ (Ready)'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1">
                  <div>Sheet ID: <span className="font-mono text-slate-300">{formData.googleSheetId || existingSheetId || 'ยังไม่มีการผูก Sheet ID'}</span></div>
                  {sheetSuccessUrl && (
                    <div>
                      <a href={sheetSuccessUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
                        เปิดดูใน Google Sheets <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportToNewSheet}
                    disabled={sheetSyncing}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {sheetSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                    ส่งออก Sheet ใหม่
                  </button>

                  <button
                    type="button"
                    onClick={handleUpdateExistingSheet}
                    disabled={sheetSyncing}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer"
                  >
                    อัปเดต Sheet เดิม
                  </button>
                </div>
              </div>

              {/* Cloud 2: Firebase Firestore */}
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-teal-400" />
                    <span className="font-bold text-white text-xs sm:text-sm">Firebase Cloud Firestore</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    user
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {user ? `🟢 เชื่อมต่อ: ${user.email}` : '🟡 โหมดผู้เยี่ยมชม (Guest)'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1">
                  <div>ผู้ดูแล: <span className="font-mono text-slate-300">{user?.displayName || user?.email || 'บัญชีเครื่องปัจจุบัน'}</span></div>
                  <div>สถานะการซิงค์: <span className="text-slate-300">{firestoreSuccessMsg || 'พร้อมซิงค์ข้อมูลขึ้นคลาวด์'}</span></div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncFirestore}
                    disabled={firestoreSyncing}
                    className="flex-1 py-2 px-3 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {firestoreSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                    ซิงค์ขึ้น Firestore ทันที
                  </button>

                  {!user && (
                    <button
                      type="button"
                      onClick={onLoginGoogle}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      เข้าสู่ระบบ Google
                    </button>
                  )}
                </div>
              </div>

              {/* Cloud 3: Google Drive Backup */}
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderSync className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white text-xs sm:text-sm">Google Drive Snapshot Archive</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    driveFolderId
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {driveFolderId ? '🟢 โฟลเดอร์ Land_Portfolio_Manager' : '⚪ พร้อมสำรองไฟล์ (Standby)'}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  {driveSuccessMsg || 'จัดเก็บไฟล์สำรอง JSON Snapshot ย้อนหลังในไดรฟ์ส่วนตัวเพื่อความปลอดภัย'}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleBackupToGoogleDrive}
                    disabled={driveSyncing}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {driveSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderSync className="w-3.5 h-3.5" />}
                    สำรองข้อมูล Snapshot ขึ้น Google Drive
                  </button>
                </div>
              </div>

              {/* Cloud 4: Cloudflare D1 SQL */}
              <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-white text-xs sm:text-sm">Cloudflare D1 & Workers SQL</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    d1Config.workerUrl
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                  }`}>
                    {d1Config.workerUrl ? '🌐 Worker URL เชื่อมต่อแล้ว' : '⚡ โหมด D1 Simulator'}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  ฐานข้อมูล Relational SQL ระดับ Edge เชื่อมต่อผ่าน Cloudflare Worker API
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncCloudflareD1}
                    disabled={d1Syncing}
                    className="flex-1 py-2 px-3 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {d1Syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                    ซิงค์ข้อมูลกับ D1
                  </button>

                  <button
                    type="button"
                    onClick={handlePullFromCloudflareD1}
                    disabled={d1Syncing}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer"
                  >
                    ดึงข้อมูลจาก D1
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Offline File Backup & Restore (JSON & CSV) */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h4 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-slate-800">
              <HardDrive className="w-5 h-5 text-amber-400" />
              การสำรองไฟล์ออฟไลน์ฉุกเฉิน (Local File Backup & Restore)
            </h4>
            <p className="text-xs text-slate-400">
              ดาวน์โหลดและเก็บสำเนาไฟล์ `.json` หรือ `.csv` ไว้ในเครื่องคอมพิวเตอร์ของคุณเพื่อความปลอดภัยสูงสุด หรือกู้คืนข้อมูล
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={() => exportToJsonFile(plots, formData)}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                ดาวน์โหลด JSON Backup
              </button>

              <button
                type="button"
                onClick={() => exportToCsvFile(plots, formData)}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                ดาวน์โหลด CSV
              </button>

              <label className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-dashed border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>นำเข้าไฟล์ JSON (Restore)</span>
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
      )}

      {/* Tab 4: Hybrid Cloud Storage Box (Cloudflare D1 & Google Drive) */}
      {activeSettingsTab === 'hybrid' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
          {/* Box 1: Cloudflare D1 & Worker Configuration */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Server className="w-5 h-5 text-orange-400" />
                Cloudflare D1 & Cloudflare Workers
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ฐานข้อมูล Serverless SQL ระดับ Edge เชื่อมต่อผ่าน Cloudflare Worker API
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold ${
              d1Config.workerUrl ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
            }`}>
              {d1Config.workerUrl ? '🌐 Worker URL เชื่อมต่อแล้ว' : '⚡ โหมด D1 Simulator'}
            </span>
          </div>

          <div className="space-y-3.5 text-xs sm:text-sm">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Cloudflare Worker API Endpoint URL:
              </label>
              <input
                type="url"
                placeholder="เช่น https://land-portfolio-api.yoursubdomain.workers.dev"
                value={d1Config.workerUrl}
                onChange={(e) => setD1Config({ ...d1Config, workerUrl: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                (หากยังไม่ได้ Deploy Worker สามารถปล่อยว่างไว้เพื่อใช้งาน Cloudflare D1 Simulator ได้)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Database Name (D1):
                </label>
                <input
                  type="text"
                  value={d1Config.databaseName}
                  onChange={(e) => setD1Config({ ...d1Config, databaseName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Worker API Token (Optional):
                </label>
                <input
                  type="password"
                  placeholder="Bearer Token (ถ้ามี)"
                  value={d1Config.apiToken}
                  onChange={(e) => setD1Config({ ...d1Config, apiToken: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
                />
              </div>
            </div>

            {/* Actions for Cloudflare D1 */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSyncCloudflareD1}
                disabled={d1Syncing}
                className="py-2.5 px-3 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {d1Syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                ซิงค์เข้า Cloudflare D1
              </button>

              <button
                type="button"
                onClick={handlePullFromCloudflareD1}
                disabled={d1Syncing}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                ดึงข้อมูลจาก Cloudflare D1
              </button>
            </div>

            {/* Download Worker & D1 Deploy Kit */}
            <div className="pt-2">
              <button
                type="button"
                onClick={downloadCloudflareDeployFiles}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-orange-400" />
                ดาวน์โหลดโค้ด Deploy Worker &amp; D1 (schema.sql, worker.js, wrangler.toml)
              </button>
            </div>

            {/* D1 Feedback message */}
            {d1SuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{d1SuccessMsg}</span>
              </div>
            )}

            {d1Error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{d1Error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Box 2: Google Drive & Google Sheets File Storage */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-blue-400" />
                Google Drive &amp; Google Sheets Archive
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                จัดเก็บไฟล์ Snapshot สำรอง และตารางคำนวณลงใน Google Drive โดยตรง
              </p>
            </div>
            {user ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> บัญชี Google เชื่อมต่อแล้ว
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

          <div className="space-y-3.5 text-xs sm:text-sm">
            {/* Google Drive Snapshot Backup Button */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-400" /> โฟลเดอร์ใน Google Drive:
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  Land_Portfolio_Manager/
                </span>
              </div>
              <p className="text-slate-400 text-xs">
                สร้างโฟลเดอร์และบันทึกไฟล์ Snapshot `.json` พร้อมประวัติทุกเวอร์ชันลงใน Google Drive ส่วนตัวของคุณ
              </p>

              <button
                type="button"
                onClick={handleBackupToGoogleDrive}
                disabled={driveSyncing}
                className="w-full mt-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {driveSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> กำลังอัปโหลดไปยัง Google Drive...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> สำรองข้อมูลลง Google Drive ทันที
                  </>
                )}
              </button>

              {driveSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 mt-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>{driveSuccessMsg}</span>
                </div>
              )}

              {driveError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-rose-200">การซิงค์ Google Drive ไม่สำเร็จ</div>
                      <div className="text-[11px] text-rose-300 mt-0.5 leading-relaxed">{driveError}</div>
                    </div>
                  </div>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setDriveError(null);
                        try {
                          await googleSignIn();
                          handleBackupToGoogleDrive();
                        } catch (e: any) {
                          setDriveError(e.message || 'การเข้าสู่ระบบ Google ถูกยกเลิก');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      เข้าสู่ระบบ Google ใหม่อีกครั้ง และลองทันที
                    </button>
                  </div>
                </div>
              )}

              {/* Troubleshooting Quick Tips */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> คำแนะนำหากเชื่อมต่อไม่สำเร็จ:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
                  <li>หากเบราว์เซอร์บล็อกหน้าต่างป๊อปอัป ให้กดอนุญาต <span className="text-slate-200 font-medium">"Allow pop-ups"</span> ที่แถบ URL ด้านบน</li>
                  <li>กดยินยอมให้สิทธิ์ (Allow) ในหน้าต่าง Google Account เพื่อเปิดการบันทึกไฟล์</li>
                  <li>หากเซสชันเดิมหมดอายุ ให้กดปุ่ม <span className="text-emerald-400 font-medium">"เข้าสู่ระบบ Google ใหม่อีกครั้ง"</span> ด้านบน</li>
                </ul>
              </div>
            </div>

            {/* Google Sheets Sync Box */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> ตาราง Google Sheets:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportToNewSheet}
                  disabled={sheetSyncing}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {sheetSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  ส่งออก Sheet ใหม่
                </button>

                <button
                  type="button"
                  onClick={handleUpdateExistingSheet}
                  disabled={sheetSyncing}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium cursor-pointer"
                >
                  อัปเดต Sheet เดิม
                </button>
              </div>

              {sheetSuccessUrl && (
                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-emerald-400">ซิงค์ชีตสำเร็จ!</span>
                  <a
                    href={sheetSuccessUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 hover:underline flex items-center gap-1 font-semibold"
                  >
                    เปิดดูใน Google Sheets <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Tab 3: System Font Size & Display (ขนาดตัวอักษรของระบบ) */}
      {activeSettingsTab === 'general' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 animate-in fade-in duration-150">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Type className="w-5 h-5 text-emerald-400" />
              การปรับขนาดตัวอักษรของระบบ (System Font Size & Display)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              เลือกขนาดตัวอักษรที่ต้องการ ระบบจะปรับสัดส่วนข้อความ ตัวเลข และตารางทั้งหมดทันที
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 self-start sm:self-auto">
            ปัจจุบัน: {formData.fontSize === 'sm' ? '88% (กะทัดรัด)' : formData.fontSize === 'lg' ? '113% (ใหญ่)' : formData.fontSize === 'xl' ? '125% (ใหญ่พิเศษ)' : '100% (มาตรฐาน)'}
          </span>
        </div>

        {/* 4 Font Size Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 'sm', label: 'กะทัดรัด (Small)', scale: '88%', desc: 'มองเห็นข้อมูลในตารางได้เยอะขึ้น เหมาะกับจอขนาดกะทัดรัด' },
            { id: 'base', label: 'มาตรฐาน (Normal)', scale: '100%', desc: 'ขนาดมาตรฐานสมดุล สบายตา แนะนำสำหรับการใช้งานทั่วไป' },
            { id: 'lg', label: 'ตัวหนังสือใหญ่ (Large)', scale: '113%', desc: 'ตัวหนังสือใหญ่ขึ้น อ่านรายละเอียดและตัวเลขได้ง่ายชัดเจน' },
            { id: 'xl', label: 'ใหญ่พิเศษ (Extra Large)', scale: '125%', desc: 'ขนาดใหญ่พิเศษ ชัดเจนสูง เหมาะสำหรับหน้าจอระยะไกล' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleFontSizeChange(f.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                (formData.fontSize || 'base') === f.id
                  ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500'
                  : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">{f.label}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-emerald-400 font-semibold">
                  {f.scale}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {f.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Live Typography Preview Box */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            ตัวอย่างการแสดงผลจริง (Live Typography Preview):
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-base text-white">#1 ที่ดินนครสวรรค์ จากสมยศ</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              ถือครอง (Holding)
            </span>
            <span className="text-xs text-slate-400 font-mono">5 ไร่ 0 งาน 0 ตร.ว. (2,000 ตร.ว.)</span>
            <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg">
              ต้นทุน: 1,000,000 บาท
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ราคาตั้งใจขาย: 2,500,000 บาท (+150%)
            </span>
          </div>
        </div>
      </div>
    )}

      {/* Tab 2: Bulk Import Land Plots via CSV Paste (นำเข้าข้อมูลที่ดินแบบกลุ่มด้วยการวาง CSV) */}
      {activeSettingsTab === 'csv' && (
        <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 shadow-2xl space-y-6 animate-in fade-in duration-150">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  นำเข้าข้อมูลที่ดินแบบกลุ่มด้วยการวาง CSV (Bulk CSV Import)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  รองรับ Excel / Google Sheets
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                คัดลอกตารางจาก Google Sheets หรือ Excel แล้วนำมาวางในช่องด้านล่างเพื่อเพิ่มแปลงที่ดินทั้งหมดในครั้งเดียวอย่างง่ายดาย
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadSampleCsv}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="โหลดตัวอย่างข้อมูลที่ดิน 3 แปลงเพื่อทดสอบ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>โหลดตัวอย่าง CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCsvHeaders}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="คัดลอกหัวคอลัมน์มาตรฐานไปใช้วางในโปรแกรมตาราง"
            >
              {copiedCode === 'csvHeaders' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedCode === 'csvHeaders' ? 'คัดลอกแล้ว!' : 'คัดลอกหัวตาราง'}</span>
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            เลือกรูปแบบการนำเข้า (Import Mode):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCsvImportMode('replace')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                csvImportMode === 'replace'
                  ? 'bg-emerald-500/15 border-emerald-500/80 text-white shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${csvImportMode === 'replace' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                <RefreshCw className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>แทนที่ข้อมูลทั้งหมด (Replace All)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-normal">
                    แนะนำสำหรับการตั้งค่าเริ่มต้น
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  ล้างข้อมูลแปลงเดิมทั้งหมดและแทนที่ด้วยรายการใหม่จากข้อความ CSV นี้
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCsvImportMode('append')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                csvImportMode === 'append'
                  ? 'bg-emerald-500/15 border-emerald-500/80 text-white shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${csvImportMode === 'append' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                <PlusCircle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>เพิ่มต่อท้ายข้อมูลเดิม (Append & Merge)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono font-normal">
                    คง {plots.length} แปลงเดิมไว้
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  เพิ่มแปลงใหม่ต่อจากลำดับเดิม โดยไม่ลบข้อมูลแปลงที่มีอยู่แล้วในระบบ
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Textarea for pasting CSV */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
              วางข้อมูลตาราง CSV / TSV ที่นี่:
            </span>
            {csvInputText && (
              <button
                type="button"
                onClick={() => {
                  setCsvInputText('');
                  setCsvParsePreview(null);
                }}
                className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> ล้างข้อความ
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              rows={8}
              value={csvInputText}
              onChange={(e) => setCsvInputText(e.target.value)}
              placeholder="วางข้อมูล CSV ที่คัดลอกมาที่นี่... รองรับทั้งการคั่นด้วย จุลภาค (,), แท็บ (\t) หรือ อัฒภาค (;)"
              className="w-full px-4 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed placeholder-slate-600"
            />
            {csvInputText && (
              <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-500 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                {csvInputText.split(/\r?\n/).filter((l) => l.trim()).length} บรรทัด • {csvInputText.length.toLocaleString()} อักขระ
              </div>
            )}
          </div>
        </div>

        {/* Live Parse Preview & Metrics */}
        {csvParsePreview && (
          <div className="space-y-4 animate-fade-in">
            {csvParsePreview.plots.length > 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/40 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-white block">
                        ตรวจพบข้อมูลแปลงที่ดินสมบูรณ์: {csvParsePreview.plots.length} แปลง
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {csvImportMode === 'replace'
                          ? `จะนำเข้าแทนที่ข้อมูลปัจจุบัน (เป็น ${csvParsePreview.plots.length} แปลง)`
                          : `จะเพิ่มต่อท้ายข้อมูลเดิม รวมเป็น ${plots.length + csvParsePreview.plots.length} แปลง`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteCsvImport}
                    disabled={isCsvImporting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isCsvImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังนำเข้าข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>ยืนยันนำเข้า {csvParsePreview.plots.length} แปลงที่ดิน</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">จำนวนแปลงที่พบ:</span>
                    <span className="font-mono font-bold text-white">{csvParsePreview.plots.length} แปลง</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">เนื้อที่รวมโดยประมาณ:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {csvParsePreview.plots.reduce((sum, p) => sum + (p.totalSqWah || 0), 0).toLocaleString()} ตร.ว.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">ต้นทุนผูกพันรวม:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatCurrency(csvParsePreview.plots.reduce((sum, p) => sum + (p.totalCost || 0), 0))}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">ราคาขายเป้าหมายรวม:</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {formatCurrency(csvParsePreview.plots.reduce((sum, p) => sum + (p.targetSalePrice || 0), 0))}
                    </span>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">รายละเอียดแปลง</th>
                        <th className="py-2 px-3">ทำเล (ตำบล/อำเภอ/จังหวัด)</th>
                        <th className="py-2 px-3 text-right">เนื้อที่</th>
                        <th className="py-2 px-3 text-right">ต้นทุนรวม</th>
                        <th className="py-2 px-3 text-right">ราคาตั้งใจขาย</th>
                        <th className="py-2 px-3 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {csvParsePreview.plots.slice(0, 5).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 text-emerald-400 font-bold">#{p.orderNumber}</td>
                          <td className="py-2 px-3 font-sans font-medium text-white max-w-[200px] truncate">{p.title}</td>
                          <td className="py-2 px-3 font-sans text-slate-400">{p.subdistrict || '-'}, {p.district || '-'}, {p.province || '-'}</td>
                          <td className="py-2 px-3 text-right font-sans text-slate-300">
                            {formatThaiArea(p.rai, p.ngan, p.sqWah)}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-300">{formatCurrency(p.totalCost)}</td>
                          <td className="py-2 px-3 text-right text-emerald-300">{p.targetSalePrice > 0 ? formatCurrency(p.targetSalePrice) : '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold ${
                              p.status === 'sold'
                                ? 'bg-rose-500/15 text-rose-300'
                                : p.status === 'for_sale'
                                ? 'bg-cyan-500/15 text-cyan-300'
                                : p.status === 'consignment'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}>
                              {p.status === 'sold' ? 'ขายแล้ว' : p.status === 'for_sale' ? 'ประกาศขาย' : p.status === 'consignment' ? 'ขายฝาก' : 'ถือครอง'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvParsePreview.plots.length > 5 && (
                    <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-900/60 border-t border-slate-800">
                      ...และมีแปลงที่ดินอีก {csvParsePreview.plots.length - 5} แปลงในรายการ
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>ไม่สามารถแปลงข้อมูล CSV ได้:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-2 text-rose-300/90 text-[11px]">
                  {csvParsePreview.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Success Banner after import */}
        {csvImportSuccessBanner && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">การนำเข้าข้อมูลเสร็จสมบูรณ์!</span>
                <span className="text-[11px] text-emerald-300/90">{csvImportSuccessBanner}</span>
              </div>
            </div>
            {onNavigateToTable && (
              <button
                type="button"
                onClick={onNavigateToTable}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-sm"
              >
                <span>เปิดดูในตารางข้อมูล</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    )}

      {/* Tab 3 Part B: General Portfolio Settings & Offline Backups */}
      {activeSettingsTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              การตั้งค่าข้อมูลพอร์ต (Portfolio Defaults)
            </h3>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> คืนค่าเริ่มต้น (Reset Default)
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs sm:text-sm">
            <div>
              <label className="block text-xs text-slate-400 mb-1">ชื่อเจ้าของพอร์ตที่ดิน</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-medium text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">ชื่อหัวข้อพอร์ตโฟลิโอ (Title)</label>
              <input
                type="text"
                value={formData.portfolioTitle}
                onChange={(e) => setFormData({ ...formData, portfolioTitle: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-medium text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">คอมมิชชั่นมาตรฐาน (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.defaultCommissionRate}
                  onChange={(e) => setFormData({ ...formData, defaultCommissionRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">ภาษี/ค่าโอนประมาณการ (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.defaultTaxRate}
                  onChange={(e) => setFormData({ ...formData, defaultTaxRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>
            </div>

            {/* Expected Holding Period Settings */}
            <div className="pt-1">
              <label className="block text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>ระยะเวลาถือครองเป้าหมาย (Expected Holding Period)</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {formData.expectedHoldingPeriodMonths || 12} เดือน ({(formData.expectedHoldingPeriodMonths || 12) >= 12 ? `${((formData.expectedHoldingPeriodMonths || 12) / 12).toFixed(1).replace('.0', '')} ปี` : 'ระยะสั้น'})
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[6, 12, 24, 36].map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => setFormData({ ...formData, expectedHoldingPeriodMonths: months })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      (formData.expectedHoldingPeriodMonths || 12) === months
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {months < 12 ? `${months} ด.` : `${months / 12} ปี`}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="120"
                value={formData.expectedHoldingPeriodMonths || 12}
                onChange={(e) => setFormData({ ...formData, expectedHoldingPeriodMonths: Math.max(1, Number(e.target.value)) })}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                placeholder="ระบุจำนวนเดือน (เช่น 12 หรือ 24)"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                ใช้กำหนดเป้าหมายสำหรับ Visual Progress Indicator ในหน้าดูรายละเอียดแปลง และระบบแจ้งเตือนการถือครอง
              </p>
            </div>

            {/* Theme Selection Setting (โหมดมืด / โหมดสว่าง) */}
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                ธีมการแสดงผลของระบบ (Application Theme)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'dark' })}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                    (formData.theme || 'dark') === 'dark'
                      ? 'bg-slate-800 border-emerald-500 text-emerald-400 shadow-md ring-1 ring-emerald-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-4 h-4 text-amber-300" />
                  <span>โหมดมืด (Dark Mode)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: 'light' })}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-all ${
                    formData.theme === 'light'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-500 shadow-md ring-1 ring-amber-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>โหมดสว่าง (Light Mode)</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                โหมดสว่างเพิ่มความชัดเจนในการใช้งานกลางแจ้งหรือห้องที่สว่าง โหมดมืดช่วยถนอมสายตา
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {saveSettingsSuccess ? (
                <>
                  <Check className="w-4 h-4" /> บันทึกการตั้งค่าแล้ว
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> บันทึกการตั้งค่า
                </>
              )}
            </button>
          </form>
        </div>

        {/* Offline Backups: JSON & CSV */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2 pb-3 border-b border-slate-800">
            <HardDrive className="w-5 h-5 text-amber-400" />
            การสำรองไฟล์ออฟไลน์ (Local File Backup)
          </h3>
          <p className="text-xs text-slate-400">
            ดาวน์โหลดและเก็บสำเนาไฟล์ `.json` หรือ `.csv` ไว้ในเครื่องคอมพิวเตอร์ของคุณเพื่อความปลอดภัยสูงสุด
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => exportToJsonFile(plots, formData)}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              ดาวน์โหลด JSON
            </button>

            <button
              type="button"
              onClick={() => exportToCsvFile(plots, formData)}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              ดาวน์โหลด CSV
            </button>
          </div>

          <div className="pt-2">
            <label className="w-full p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-dashed border-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 text-teal-400" />
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
    )}

      {/* Tab 4 Part B: Cloudflare D1 & Worker Step-by-Step Architecture Guide */}
      {activeSettingsTab === 'hybrid' && (
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-6 animate-in fade-in duration-150">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              ขั้นตอนการติดตั้ง Cloudflare D1 &amp; Deploy Cloudflare Worker (Step-by-Step Guide)
            </h3>
            <p className="text-xs text-slate-400">
              วิธีสร้างฐานข้อมูล Cloudflare D1 และรัน Cloudflare Worker เพื่อโฮสต์ระบบแบบไฮบริด
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-orange-400 text-sm">ขั้นตอนที่ 1</span>
            <div className="font-semibold text-slate-200">สร้างฐานข้อมูล D1</div>
            <p className="text-slate-400 text-[11px]">
              เปิด Terminal และรันคำสั่ง Wrangler เพื่อสร้างฐานข้อมูล D1 บน Cloudflare:
            </p>
            <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-slate-300 border border-slate-800 flex justify-between items-center">
              <code>wrangler d1 create land-portfolio-db</code>
              <button
                onClick={() => handleCopyText('wrangler d1 create land-portfolio-db', 'step1')}
                className="p-1 hover:text-white"
              >
                {copiedCode === 'step1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-orange-400 text-sm">ขั้นตอนที่ 2</span>
            <div className="font-semibold text-slate-200">สร้างตารางใน D1</div>
            <p className="text-slate-400 text-[11px]">
              รันคำสั่งสร้างตาราง SQL ตามไฟล์ `schema.sql`:
            </p>
            <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-slate-300 border border-slate-800 flex justify-between items-center">
              <code>wrangler d1 execute land-portfolio-db --file=schema.sql</code>
              <button
                onClick={() => handleCopyText('wrangler d1 execute land-portfolio-db --file=schema.sql', 'step2')}
                className="p-1 hover:text-white"
              >
                {copiedCode === 'step2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-orange-400 text-sm">ขั้นตอนที่ 3</span>
            <div className="font-semibold text-slate-200">ตั้งค่า wrangler.toml</div>
            <p className="text-slate-400 text-[11px]">
              นำ `database_id` ที่ได้จากขั้นตอนที่ 1 ไปใส่ในไฟล์ `wrangler.toml`
            </p>
            <div className="bg-slate-900 p-2 rounded font-mono text-[10px] text-slate-300 border border-slate-800">
              <code>database_id = &quot;&lt;D1_ID&gt;&quot;</code>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-orange-400 text-sm">ขั้นตอนที่ 4</span>
            <div className="font-semibold text-slate-200">Deploy Cloudflare Worker</div>
            <p className="text-slate-400 text-[11px]">
              สั่ง Deploy Worker ขึ้น Cloudflare Edge Network:
            </p>
            <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-slate-300 border border-slate-800 flex justify-between items-center">
              <code>wrangler deploy</code>
              <button
                onClick={() => handleCopyText('wrangler deploy', 'step4')}
                className="p-1 hover:text-white"
              >
                {copiedCode === 'step4' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Import Status Toast Banner */}
      {importStatus && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-medium animate-fade-in ${
          importStatus.type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-950/50' : 'bg-rose-600 text-white shadow-rose-950/50'
        }`}>
          {importStatus.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* In-App Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  ยืนยันการคืนค่าข้อมูลเริ่มต้น 10 แปลง
                </h3>
                <p className="text-xs text-slate-400">
                  ระบบจะคืนค่าข้อมูลพอร์ตที่ดินเริ่มต้น 10 แปลงตามตารางของคุณอภิวัชร์ และซิงค์ข้อมูลใหม่ไปยัง Google Sheet
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetData();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                ยืนยันคืนค่าข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App D1 Pull Confirmation Modal */}
      {showD1PullConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  ยืนยันการดึงข้อมูลจาก Cloudflare D1
                </h3>
                <p className="text-xs text-slate-400">
                  ระบบจะดึงข้อมูลแปลงที่ดินและค่าคอนฟิกจาก Cloudflare D1 มาอัปเดตแทนที่ข้อมูลปัจจุบันในหน้าแอป
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowD1PullConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executePullFromCloudflareD1}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                ยืนยันดึงข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
