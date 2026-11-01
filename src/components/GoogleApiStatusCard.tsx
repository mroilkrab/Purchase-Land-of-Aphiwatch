import React, { useState, useEffect } from 'react';
import { 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  ShieldCheck, 
  FileSpreadsheet, 
  HardDrive, 
  ExternalLink,
  HelpCircle,
  Trash2,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  checkGoogleApiStatus, 
  clearCachedGoogleTokens, 
  GoogleApiConnectionStatus 
} from '../services/googleAuthDiagnostics';
import { googleSignIn, connectGoogleSheetsScope, hasGrantedSheetsScope } from '../services/firebaseAuth';

interface GoogleApiStatusCardProps {
  onScopeUpdated?: () => void;
  onOpenTroubleshootModal?: () => void;
}

export const GoogleApiStatusCard: React.FC<GoogleApiStatusCardProps> = ({
  onScopeUpdated,
  onOpenTroubleshootModal,
}) => {
  const [status, setStatus] = useState<GoogleApiConnectionStatus | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [elevating, setElevating] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const runDiagnostic = async () => {
    setChecking(true);
    setActionFeedback(null);
    try {
      const res = await checkGoogleApiStatus();
      setStatus(res);
      if (res.statusLevel === 'ready') {
        setActionFeedback({
          type: 'success',
          message: `ตรวจสอบสำเร็จ: สิทธิ์ Google Sheets & Drive สมบูรณ์ 100% (${res.timestamp})`,
        });
      } else if (res.statusLevel === 'needs_elevation') {
        setActionFeedback({
          type: 'info',
          message: 'พบปัญหา: โทเค็นปัจจุบันยังขาดสิทธิ์ Google Sheets (กด "ยกระดับสิทธิ์" ด้านล่าง)',
        });
      } else if (res.statusLevel === 'expired') {
        setActionFeedback({
          type: 'error',
          message: 'โทเค็นหมดอายุแล้ว กรุณากดปุ่ม "ยกระดับ / รีเฟรชสิทธิ์" เพื่อขอโทเค็นใหม่',
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์',
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const handleElevateScope = async () => {
    setElevating(true);
    setActionFeedback(null);
    try {
      const result = await googleSignIn({ requestSheetsScope: true });
      if (result?.accessToken) {
        setActionFeedback({
          type: 'success',
          message: '🎉 ยกระดับสิทธิ์สำเร็จ! บัญชีของคุณได้รับสิทธิ์เข้าถึง Google Sheets & Drive แล้ว',
        });
        const res = await checkGoogleApiStatus(result.accessToken);
        setStatus(res);
        if (onScopeUpdated) onScopeUpdated();
      } else {
        setActionFeedback({
          type: 'error',
          message: 'ไม่ได้รับ Access Token จาก Google กรุณาลองใหม่อีกครั้ง',
        });
      }
    } catch (err: any) {
      console.error('Scope elevation error:', err);
      const isCancelled = err?.code === 'auth/popup-closed-by-user';
      if (isCancelled) {
        setActionFeedback({
          type: 'info',
          message: 'คุณได้ปิดหน้าต่างป๊อปอัปก่อนที่จะอนุญาตสิทธิ์',
        });
      } else {
        setActionFeedback({
          type: 'error',
          message: err.message || 'เกิดข้อผิดพลาดในการขอสิทธิ์ Google Sheets',
        });
      }
    } finally {
      setElevating(false);
    }
  };

  const handleClearCache = () => {
    clearCachedGoogleTokens();
    setActionFeedback({
      type: 'info',
      message: 'ล้างแคช Token ในเบราว์เซอร์เรียบร้อยแล้ว กำลังตรวจสอบสถานะใหม่...',
    });
    setTimeout(() => {
      runDiagnostic();
      if (onScopeUpdated) onScopeUpdated();
    }, 600);
  };

  // Status Styling Helpers
  const getBadge = () => {
    if (!status) return null;
    switch (status.statusLevel) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            🟢 ได้รับสิทธิ์ครบถ้วน (Ready & Verified)
          </span>
        );
      case 'needs_elevation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            🟡 ขาดสิทธิ์ Google Sheets (Need Scope Elevation)
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            🔴 Token หมดอายุ (Expired)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            ⚪ ยังไม่เข้าสู่ระบบ Google
          </span>
        );
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                สถานะการเชื่อมต่อ Google API & การอนุญาตสิทธิ์ (OAuth Scope Inspector)
              </h3>
              <p className="text-xs text-slate-400">
                ตรวจสอบและแก้ไขสิทธิ์การเข้าถึง Google Sheets & Google Drive แบบ Real-time ป้องกันข้อผิดพลาด 403 Insufficient Scopes
              </p>
            </div>
          </div>
        </div>
        <div>{getBadge()}</div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : actionFeedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : actionFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
          )}
          <span className="font-medium flex-1">{actionFeedback.message}</span>
        </div>
      )}

      {/* Main Diagnostic Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Box 1: Overall Token Info */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">ข้อมูล Token ในระบบ</span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">ระดับสิทธิ์ (Token Type):</span>
              <span className="font-mono font-semibold text-slate-200">
                {status?.tokenType === 'elevated_sheets' ? (
                  <span className="text-emerald-400">Elevated (Sheets + Drive)</span>
                ) : status?.tokenType === 'base_profile' ? (
                  <span className="text-amber-400">Base (Profile only)</span>
                ) : (
                  <span className="text-slate-500">None</span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">อีเมลที่ผูกกับ Token:</span>
              <span className="font-mono text-slate-300 truncate max-w-[170px]" title={status?.email || '-'}>
                {status?.email || '-'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">อายุ Token ที่เหลือ:</span>
              <span className="font-semibold text-slate-200">
                {status?.expiresInSeconds ? (
                  `${Math.round(status.expiresInSeconds / 60)} นาที (${status.expiresInSeconds} วินาที)`
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">ตรวจสอบล่าสุด:</span>
              <span className="font-mono text-slate-400">{status?.timestamp || '-'}</span>
            </div>
          </div>
        </div>

        {/* Box 2 & 3: Scope Breakdown Checklist */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              ผลการตรวจรับรอง Google OAuth Scopes
            </span>
            <span className="text-[11px] text-slate-400">
              {status?.scopes?.length || 0} Scope(s) ได้รับอนุญาต
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {status?.scopeDetails.map((sc) => (
              <div
                key={sc.scopeUrl}
                className={`p-3 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                  sc.status === 'granted'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : sc.isRequiredForSheets
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    {sc.name.includes('Sheets') ? (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : sc.name.includes('Drive') ? (
                      <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{sc.name}</span>
                  </div>
                  {sc.status === 'granted' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                      ✓ อนุญาตแล้ว
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      ✕ ยังไม่อนุญาต
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{sc.descriptionThai}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contextual Warning & Guidance Banner if needs elevation */}
      {status?.statusLevel === 'needs_elevation' && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/50 via-slate-900 to-amber-950/30 border border-amber-500/40 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>สาเหตุที่ Google Sheets ซิงค์ไม่ผ่าน: Request had insufficient authentication scopes</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            บัญชีของคุณได้รับการล็อกอินเบื้องต้นแล้ว แต่ Google กำหนดให้ต้องมีการกดยินยอมให้สิทธิ์เขียนไฟล์ในตาราง
            (Scope: <code>spreadsheets</code> และ <code>drive.file</code>) เพิ่มเติมอีก 1 ขั้นตอนเพื่อความปลอดภัย
            เพียงกดปุ่ม <strong>"ยกระดับสิทธิ์ Google Sheets ตอนนี้"</strong> ระบบจะเปิดหน้าจอขออนุญาตและเชื่อมต่อให้อัตโนมัติทันที
          </p>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Button 1: Re-check diagnostics */}
          <button
            type="button"
            onClick={runDiagnostic}
            disabled={checking}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-sm hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{checking ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสิทธิ์การเข้าถึง'}</span>
          </button>

          {/* Button 2: Elevate / Fix Scope */}
          <button
            type="button"
            onClick={handleElevateScope}
            disabled={elevating}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-98 ${
              status?.statusLevel === 'ready'
                ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border border-amber-400 shadow-amber-500/20 animate-pulse'
            }`}
          >
            {elevating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังเปิดป๊อปอัป Google...</span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5" />
                <span>
                  {status?.statusLevel === 'ready'
                    ? 'รีเฟรชสิทธิ์ Google Sheets'
                    : 'ยกระดับสิทธิ์ Google Sheets ตอนนี้ (1-Click)'}
                </span>
              </>
            )}
          </button>

          {/* Button 3: Clear Token Cache (Troubleshoot) */}
          <button
            type="button"
            onClick={handleClearCache}
            className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-800 transition-colors cursor-pointer"
            title="ล้างแคช Token ในหน่วยความจำเพื่อแก้ปัญหา Token ค้าง"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>ล้างแคช Token</span>
          </button>
        </div>

        {/* Troubleshoot helper link */}
        {onOpenTroubleshootModal && (
          <button
            type="button"
            onClick={onOpenTroubleshootModal}
            className="text-xs text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1.5 cursor-pointer font-medium py-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>ดูคู่มือแก้ปัญหา Google Auth / สิทธิ์โดเมน</span>
          </button>
        )}
      </div>
    </div>
  );
};
