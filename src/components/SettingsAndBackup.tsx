import React, { useState, useEffect } from 'react';
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
  Type
} from 'lucide-react';
import { PortfolioSettings, LandPlot } from '../types/land';
import { createGoogleSheet, updateExistingGoogleSheet } from '../services/googleSheets';
import { getAccessToken, syncToFirestore, loadFromFirestore, googleSignIn } from '../services/firebaseAuth';
import { exportToJsonFile, exportToCsvFile } from '../services/storage';
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Section: System Font Size Preference (ขนาดตัวอักษรของระบบ) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
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

      {/* Box 3: General Portfolio Settings & Offline Backups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Cloudflare D1 & Worker Step-by-Step Architecture Guide */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-6">
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
