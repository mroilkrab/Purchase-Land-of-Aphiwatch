import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  Globe, 
  HelpCircle,
  FileCode,
  Terminal,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { GoogleAuthErrorInfo, getDomainDiagnosticInfo, activeFirebaseConfig } from '../services/firebaseAuth';

interface GoogleAuthTroubleshootModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorInfo?: GoogleAuthErrorInfo | null;
  onRetry: () => void;
}

export const GoogleAuthTroubleshootModal: React.FC<GoogleAuthTroubleshootModalProps> = ({
  isOpen,
  onClose,
  errorInfo,
  onRetry,
}) => {
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [activeTab, setActiveTab] = useState<'firebase' | 'oauth' | 'vercel'>('firebase');

  if (!isOpen) return null;

  const diag = getDomainDiagnosticInfo();
  const hostname = errorInfo?.currentHostname || diag.hostname;
  const projectId = errorInfo?.projectId || diag.projectId;
  const authDomain = errorInfo?.authDomain || diag.authDomain;

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(hostname);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const sampleEnvText = `VITE_FIREBASE_API_KEY=${activeFirebaseConfig.apiKey || ''}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain}
VITE_FIREBASE_PROJECT_ID=${projectId}
VITE_FIREBASE_APP_ID=${activeFirebaseConfig.appId || ''}
VITE_FIREBASE_STORAGE_BUCKET=${activeFirebaseConfig.storageBucket || `${projectId}.firebasestorage.app`}
VITE_FIREBASE_MESSAGING_SENDER_ID=${activeFirebaseConfig.messagingSenderId || ''}
VITE_FIREBASE_OAUTH_CLIENT_ID=${activeFirebaseConfig.oAuthClientId || ''}`;

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(sampleEnvText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  แก้ไขปัญหาเชื่อมต่อ Google บน Vercel
                </h3>
                {hostname.includes('vercel.app') && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Vercel App
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {errorInfo?.code === 'auth/unauthorized-domain' 
                  ? 'สาเหตุ: โดเมน Vercel ยังไม่ได้ถูกเพิ่มใน Authorized Domains ของ Firebase' 
                  : errorInfo?.title || 'คู่มือการอนุญาตโดเมนและการตั้งค่า Google OAuth'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 text-xs sm:text-sm">
          {/* Current Domain Box with One-Click Copy */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                ชื่อโดเมนเว็บไซต์ของคุณในขณะนี้ (Current Domain):
              </span>
              <span className="text-[11px] font-mono text-slate-500">Host</span>
            </div>
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
              <code className="text-sm sm:text-base font-mono font-bold text-amber-300 break-all">
                {hostname}
              </code>
              <button
                type="button"
                onClick={handleCopyDomain}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-emerald-600/20 active:scale-95"
              >
                {copiedDomain ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedDomain ? 'คัดลอกแล้ว!' : 'คัดลอกโดเมน'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              *เมื่อนำเว็บขึ้น Vercel หรือเซิร์ฟเวอร์ใหม่ทุกครั้ง ต้องนำชื่อโดเมนนี้ไปเพิ่มใน Firebase Console จึงจะเข้าสู่ระบบ Google ได้
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-xs gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('firebase')}
              className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'firebase'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              1. เพิ่มใน Firebase Console (สำคัญที่สุด ⭐)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('oauth')}
              className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'oauth'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              2. Google Cloud OAuth Origins
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vercel')}
              className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'vercel'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              3. Vercel Env Vars (ทางเลือก)
            </button>
          </div>

          {/* Tab 1: Firebase Console (The #1 fix) */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-300">
                  <ShieldCheck className="w-4 h-4" /> ทำไมถึงล็อกอินไม่ได้บน Vercel?
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Google & Firebase มีระบบความปลอดภัยที่ป้องกันไม่ให้เว็บแปลกปลอมนำรหัส OAuth ไปใช้ โดยจะอนุญาตเฉพาะโดเมนที่ระบุไว้ใน Authorized Domains เท่านั้น เมื่อนำเว็บไป Deploy บน Vercel จึงต้องเพิ่มโดเมน Vercel เข้าไปในระบบ 1 ครั้ง
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <h4 className="font-bold text-white text-sm">ขั้นตอนการเพิ่มโดเมนใน Firebase (ใช้เวลาไม่เกิน 1 นาที):</h4>
                
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">คัดลอกชื่อโดเมนของคุณ</p>
                    <p className="text-slate-400 text-[11px]">
                      กดปุ่ม <span className="text-emerald-400 font-semibold">"คัดลอกโดเมน"</span> ด้านบน หรือคัดลอกคำว่า: <code className="text-amber-300 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">{hostname}</code>
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <div className="space-y-2 flex-1">
                    <p className="font-semibold text-slate-200">เปิดหน้าตั้งค่า Authorized Domains ใน Firebase Console</p>
                    <p className="text-slate-400 text-[11px]">
                      กดปุ่มด้านล่างนี้เพื่อเปิดหน้าตั้งค่าของโปรเจกต์ <span className="font-mono text-emerald-400">{projectId}</span> โดยตรง
                    </p>
                    <a
                      href={`https://console.firebase.google.com/project/${projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิด Firebase Console: Authorized Domains</span>
                    </a>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">กดปุ่ม "เพิ่มโดเมน (Add domain)" และบันทึก</p>
                    <p className="text-slate-400 text-[11px]">
                      เลื่อนลงมาที่หัวข้อ <strong>"โดเมนที่ได้รับอนุญาต (Authorized domains)"</strong> กดปุ่ม <strong>"เพิ่มโดเมน"</strong> วางชื่อโดเมน แล้วกด <strong>"บันทึก (Save)"</strong>
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">4</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200">กลับมาหน้านี้และกดเข้าสู่ระบบ Google ใหม่อีกครั้ง</p>
                    <p className="text-slate-400 text-[11px]">
                      เมื่อบันทึกแล้ว จะสามารถกดปุ่ม "ลองเข้าสู่ระบบ Google อีกครั้ง" ด้านล่างนี้เพื่อเข้าใช้งานได้ทันทีโดยไม่ต้อง Deploy ใหม่!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Google Cloud Console */}
          {activeTab === 'oauth' && (
            <div className="space-y-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                หากเพิ่มใน Firebase Authorized domains แล้วยังพบปัญหาเกี่ยวกับ OAuth Client หรือ Redirect URI สามารถตรวจสอบที่ <strong>Google Cloud Console</strong> เพิ่มเติมได้:
              </p>
              
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-semibold text-slate-200 block">
                  1. Authorized JavaScript Origins (แหล่งที่มา JavaScript ที่ได้รับอนุญาต):
                </span>
                <p className="text-slate-400 text-[11px]">
                  ต้องมี Origin ของ Vercel: <code className="text-amber-300 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">https://{hostname}</code>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-semibold text-slate-200 block">
                  2. Authorized Redirect URIs (URI การเปลี่ยนเส้นทางที่ได้รับอนุญาต):
                </span>
                <p className="text-slate-400 text-[11px]">
                  ต้องมี Firebase Auth Handler URI: <code className="text-emerald-300 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">https://{authDomain}/__/auth/handler</code>
                </p>
              </div>

              <div className="pt-2">
                <a
                  href={`https://console.cloud.google.com/apis/credentials?project=${projectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  <span>เปิด Google Cloud Console: OAuth Credentials</span>
                </a>
              </div>
            </div>
          )}

          {/* Tab 3: Vercel Env Vars */}
          {activeTab === 'vercel' && (
            <div className="space-y-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                ในระบบได้แนบไฟล์ <code className="font-mono text-emerald-400">firebase-applet-config.json</code> ไว้ให้แล้ว แต่หากต้องการใช้ Environment Variables ใน Vercel Dashboard (Project Settings -&gt; Environment Variables) สามารถคัดลอกค่าต่อไปนี้ไปวางได้ทันที:
              </p>

              <div className="relative p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                <pre>{sampleEnvText}</pre>
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedEnv ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEnv ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>เมื่อเพิ่มโดเมนแล้ว ไม่จำเป็นต้อง Build ใหม่ กดเข้าสู่ระบบได้ทันที</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ลองเข้าสู่ระบบ Google อีกครั้ง</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
