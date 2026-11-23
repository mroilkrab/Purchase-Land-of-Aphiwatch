import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  ExternalLink,
  Copy,
  Check,
  PlusCircle,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Globe,
  Share2,
  FileSpreadsheet,
  FolderSync,
  Server,
  Save,
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Compass,
  X,
} from 'lucide-react';
import {
  PortfolioSettings,
  SystemLinkItem,
  SystemLinkCategory,
} from '../types/land';
import {
  DEFAULT_DEV_APP_URL,
  DEFAULT_SHARED_APP_URL,
  DEFAULT_SYSTEM_LINKS,
} from '../data/defaultLandData';
import { CloudflareD1Config } from '../services/cloudflareD1';
import {
  SYSTEM_LINK_CATEGORIES,
  getCategoryMeta,
  normalizeSystemUrl,
  isValidHttpUrl,
  extractGoogleSheetId,
  buildGoogleSheetUrl,
  getPrimarySystemUrl,
  copyTextSafely,
  buildShareInviteMessage,
} from '../utils/systemLinks';

interface SystemLinksManagerProps {
  settings: PortfolioSettings;
  onUpdateSettings: (updated: PortfolioSettings) => void;
  d1Config: CloudflareD1Config;
  onUpdateD1Config: (updated: CloudflareD1Config) => void;
}

export const SystemLinksManager: React.FC<SystemLinksManagerProps> = ({
  settings,
  onUpdateSettings,
  d1Config,
  onUpdateD1Config,
}) => {
  // Primary System URLs state
  const [sharedAppUrl, setSharedAppUrl] = useState(
    settings.sharedAppUrl ?? DEFAULT_SHARED_APP_URL
  );
  const [devAppUrl, setDevAppUrl] = useState(
    settings.devAppUrl ?? DEFAULT_DEV_APP_URL
  );
  const [customAppUrl, setCustomAppUrl] = useState(settings.customAppUrl ?? '');

  // Connected Cloud Service URLs state
  const [sheetInput, setSheetInput] = useState(
    settings.googleSheetId ? buildGoogleSheetUrl(settings.googleSheetId) : ''
  );
  const [driveFolderUrl, setDriveFolderUrl] = useState(
    settings.googleDriveFolderUrl ?? ''
  );
  const [workerUrl, setWorkerUrl] = useState(d1Config.workerUrl ?? '');

  // Custom links list
  const [links, setLinks] = useState<SystemLinkItem[]>(
    settings.systemLinks ?? DEFAULT_SYSTEM_LINKS
  );

  // Sync local form fields when settings prop updates externally
  useEffect(() => {
    setSharedAppUrl(settings.sharedAppUrl ?? DEFAULT_SHARED_APP_URL);
    setDevAppUrl(settings.devAppUrl ?? DEFAULT_DEV_APP_URL);
    setCustomAppUrl(settings.customAppUrl ?? '');
    setSheetInput(
      settings.googleSheetId ? buildGoogleSheetUrl(settings.googleSheetId) : ''
    );
    setDriveFolderUrl(settings.googleDriveFolderUrl ?? '');
    setLinks(settings.systemLinks ?? DEFAULT_SYSTEM_LINKS);
  }, [settings]);

  useEffect(() => {
    setWorkerUrl(d1Config.workerUrl ?? '');
  }, [d1Config.workerUrl]);

  // UI feedback & copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Add / Edit Custom Link state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategory, setLinkCategory] = useState<SystemLinkCategory>('team_resource');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkPinned, setLinkPinned] = useState(true);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);

  // Filter / Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SystemLinkCategory | 'all'>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    const ok = await copyTextSafely(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } else {
      showStatus('error', 'เบราว์เซอร์จำกัดสิทธิ์คลิปบอร์ด กรุณาคัดลอกลิงก์จากช่องกรอกโดยตรง');
    }
  };

  const currentOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';

  const previewSettings: PortfolioSettings = useMemo(
    () => ({
      ...settings,
      sharedAppUrl,
      devAppUrl,
      customAppUrl,
      googleSheetId: extractGoogleSheetId(sheetInput) || undefined,
      googleDriveFolderUrl: normalizeSystemUrl(driveFolderUrl) || undefined,
      systemLinks: links,
    }),
    [settings, sharedAppUrl, devAppUrl, customAppUrl, sheetInput, driveFolderUrl, links]
  );

  const primaryActiveUrl = useMemo(
    () => getPrimarySystemUrl(previewSettings),
    [previewSettings]
  );

  const shareMessagePreview = useMemo(
    () => buildShareInviteMessage(previewSettings, primaryActiveUrl),
    [previewSettings, primaryActiveUrl]
  );

  // Save Primary App URLs + Cloud Service URLs together
  const handleSaveCoreLinks = (e: React.FormEvent) => {
    e.preventDefault();

    const normShared = sharedAppUrl.trim() ? normalizeSystemUrl(sharedAppUrl) : '';
    if (sharedAppUrl.trim() && !normShared) {
      showStatus('error', 'URL ระบบหลักสำหรับแชร์ไม่ถูกต้อง (ต้องเป็นลิงก์ http:// หรือ https://)');
      return;
    }

    const normDev = devAppUrl.trim() ? normalizeSystemUrl(devAppUrl) : '';
    if (devAppUrl.trim() && !normDev) {
      showStatus('error', 'URL สำหรับพัฒนา (Development URL) ไม่ถูกต้อง');
      return;
    }

    const normCustom = customAppUrl.trim() ? normalizeSystemUrl(customAppUrl) : '';
    if (customAppUrl.trim() && !normCustom) {
      showStatus('error', 'Custom Domain / Vercel URL ไม่ถูกต้อง');
      return;
    }

    const normDrive = driveFolderUrl.trim() ? normalizeSystemUrl(driveFolderUrl) : '';
    if (driveFolderUrl.trim() && !normDrive) {
      showStatus('error', 'ลิงก์โฟลเดอร์ Google Drive ไม่ถูกต้อง');
      return;
    }

    const normWorker = workerUrl.trim() ? normalizeSystemUrl(workerUrl) : '';
    if (workerUrl.trim() && !normWorker) {
      showStatus('error', 'Cloudflare Worker API URL ไม่ถูกต้อง');
      return;
    }

    const extractedSheetId = extractGoogleSheetId(sheetInput);

    const updatedSettings: PortfolioSettings = {
      ...settings,
      sharedAppUrl: normShared,
      devAppUrl: normDev,
      customAppUrl: normCustom,
      googleSheetId: extractedSheetId || undefined,
      googleDriveFolderUrl: normDrive || undefined,
      systemLinks: links,
    };

    onUpdateSettings(updatedSettings);
    onUpdateD1Config({
      ...d1Config,
      workerUrl: normWorker,
    });

    // Reflect normalized values in inputs
    setSharedAppUrl(normShared);
    setDevAppUrl(normDev);
    setCustomAppUrl(normCustom);
    setDriveFolderUrl(normDrive);
    setWorkerUrl(normWorker);
    setSheetInput(extractedSheetId ? buildGoogleSheetUrl(extractedSheetId) : '');

    showStatus('success', 'บันทึกและอัปเดตลิงก์ระบบทั้งหมดเรียบร้อยแล้ว (ใช้งานได้ทันที)');
  };

  const handleResetDefaultAppUrls = () => {
    setSharedAppUrl(DEFAULT_SHARED_APP_URL);
    setDevAppUrl(DEFAULT_DEV_APP_URL);
    const updatedSettings: PortfolioSettings = {
      ...settings,
      sharedAppUrl: DEFAULT_SHARED_APP_URL,
      devAppUrl: DEFAULT_DEV_APP_URL,
      customAppUrl: customAppUrl.trim() ? normalizeSystemUrl(customAppUrl) : '',
      googleSheetId: extractGoogleSheetId(sheetInput) || undefined,
      googleDriveFolderUrl: driveFolderUrl.trim()
        ? normalizeSystemUrl(driveFolderUrl)
        : undefined,
      systemLinks: links,
    };
    onUpdateSettings(updatedSettings);
    showStatus('success', 'คืนค่า URL ระบบหลักและ URL พัฒนาเป็นค่ามาตรฐานแล้ว');
  };

  // Custom Links CRUD
  const resetLinkForm = () => {
    setEditingLinkId(null);
    setLinkLabel('');
    setLinkUrl('');
    setLinkCategory('team_resource');
    setLinkDescription('');
    setLinkPinned(true);
    setLinkFormError(null);
    setShowAddForm(false);
  };

  const startEditLink = (item: SystemLinkItem) => {
    setEditingLinkId(item.id);
    setLinkLabel(item.label);
    setLinkUrl(item.url);
    setLinkCategory(item.category);
    setLinkDescription(item.description || '');
    setLinkPinned(Boolean(item.isPinned));
    setLinkFormError(null);
    setShowAddForm(true);
  };

  const persistLinks = (nextLinks: SystemLinkItem[], message: string) => {
    setLinks(nextLinks);
    onUpdateSettings({
      ...previewSettings,
      systemLinks: nextLinks,
    });
    showStatus('success', message);
  };

  const handleSaveCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkFormError(null);

    if (!linkLabel.trim()) {
      setLinkFormError('กรุณาระบุชื่อลิงก์ที่ต้องการแสดง');
      return;
    }

    const normalized = normalizeSystemUrl(linkUrl);
    if (!normalized) {
      setLinkFormError('URL ไม่ถูกต้อง กรุณากรอกลิงก์เว็บไซต์ที่ขึ้นต้นด้วย https:// หรือ http://');
      return;
    }

    const nowIso = new Date().toISOString();

    if (editingLinkId) {
      const nextLinks = links.map((item) =>
        item.id === editingLinkId
          ? {
              ...item,
              label: linkLabel.trim(),
              url: normalized,
              category: linkCategory,
              description: linkDescription.trim() || undefined,
              isPinned: linkPinned,
              updatedAt: nowIso,
            }
          : item
      );
      persistLinks(nextLinks, `อัปเดตลิงก์ "${linkLabel.trim()}" เรียบร้อยแล้ว`);
      resetLinkForm();
    } else {
      const newItem: SystemLinkItem = {
        id: `sys-link-${Date.now()}`,
        label: linkLabel.trim(),
        url: normalized,
        category: linkCategory,
        description: linkDescription.trim() || undefined,
        isPinned: linkPinned,
        updatedAt: nowIso,
      };
      persistLinks([newItem, ...links], `เพิ่มลิงก์ "${newItem.label}" เข้าระบบแล้ว`);
      resetLinkForm();
    }
  };

  const handleTogglePin = (id: string) => {
    const nextLinks = links.map((item) =>
      item.id === id
        ? { ...item, isPinned: !item.isPinned, updatedAt: new Date().toISOString() }
        : item
    );
    const target = nextLinks.find((item) => item.id === id);
    persistLinks(
      nextLinks,
      target?.isPinned
        ? `ปักหมุด "${target.label}" ไว้ในเมนูลิงก์ด่วนด้านบนแล้ว`
        : `ยกเลิกปักหมุด "${target?.label}" แล้ว`
    );
  };

  const handleDeleteLink = (id: string) => {
    const target = links.find((l) => l.id === id);
    const nextLinks = links.filter((l) => l.id !== id);
    setPendingDeleteId(null);
    persistLinks(nextLinks, `ลบลิงก์ "${target?.label || ''}" ออกแล้ว`);
  };

  const handleRestoreStarterLinks = () => {
    const existingUrls = new Set(links.map((l) => normalizeSystemUrl(l.url)));
    const missingStarters = DEFAULT_SYSTEM_LINKS.filter(
      (s) => !existingUrls.has(normalizeSystemUrl(s.url))
    );
    if (missingStarters.length === 0) {
      showStatus('success', 'ลิงก์หน่วยงานที่ดินแนะนำทั้งหมดมีอยู่ในรายการแล้ว');
      return;
    }
    const nextLinks = [...links, ...missingStarters];
    persistLinks(
      nextLinks,
      `เติมลิงก์แนะนำเริ่มต้นเพิ่ม ${missingStarters.length} รายการเรียบร้อย`
    );
  };

  const filteredLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return links
      .filter((item) => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
  }, [links, categoryFilter, searchQuery]);

  const extractedSheetIdPreview = extractGoogleSheetId(sheetInput);
  const liveSheetUrl = buildGoogleSheetUrl(extractedSheetIdPreview);
  const liveDriveUrl = normalizeSystemUrl(driveFolderUrl);
  const liveWorkerUrl = normalizeSystemUrl(workerUrl);

  return (
    <div className="space-y-6 animate-in fade-in duration-150 min-w-0">
      {/* Status Toast / Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="min-w-0 break-words">{feedback.message}</span>
        </div>
      )}

      {/* Section 1 & 2 Form: Core App URLs + Cloud Service Links */}
      <form onSubmit={handleSaveCoreLinks} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Primary Application URLs & Quick Share */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>ลิงก์เข้าใช้งานระบบหลัก (App URLs)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  อัปเดต URL จริงสำหรับเปิดใช้งาน แชร์ให้ทีม หรือเชื่อมต่อโดเมนส่วนตัว
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaultAppUrls}
                className="text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0"
                title="คืนค่า URL มาตรฐานของระบบ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>คืนค่ามาตรฐาน</span>
              </button>
            </div>

            {/* Shared / Production App URL */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  ลิงก์ใช้งานจริง / แชร์ทีม (Shared App URL)
                </label>
                {currentOrigin && (
                  <button
                    type="button"
                    onClick={() => setSharedAppUrl(currentOrigin)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Compass className="w-3 h-3" />
                    <span>ใช้ URL ปัจจุบันที่เปิดอยู่</span>
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={sharedAppUrl}
                  onChange={(e) => setSharedAppUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(normalizeSystemUrl(sharedAppUrl) || sharedAppUrl, 'shared')}
                    disabled={!sharedAppUrl.trim()}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="คัดลอกลิงก์"
                  >
                    {copiedKey === 'shared' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'shared' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                  {isValidHttpUrl(sharedAppUrl) && (
                    <a
                      href={normalizeSystemUrl(sharedAppUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="เปิดลิงก์ในแท็บใหม่"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิด</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Development App URL */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  ลิงก์สภาพแวดล้อมพัฒนา (Development URL)
                </label>
                {currentOrigin && (
                  <button
                    type="button"
                    onClick={() => setDevAppUrl(currentOrigin)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Compass className="w-3 h-3" />
                    <span>ดึงจากเบราว์เซอร์</span>
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={devAppUrl}
                  onChange={(e) => setDevAppUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(normalizeSystemUrl(devAppUrl) || devAppUrl, 'dev')}
                    disabled={!devAppUrl.trim()}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {copiedKey === 'dev' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'dev' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                  {isValidHttpUrl(devAppUrl) && (
                    <a
                      href={normalizeSystemUrl(devAppUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิด</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Domain / Vercel URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                ลิงก์โดเมนส่วนตัว / Vercel (Custom Domain - ถ้ามี)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customAppUrl}
                  onChange={(e) => setCustomAppUrl(e.target.value)}
                  placeholder="เช่น https://land-portfolio.vercel.app"
                  className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(normalizeSystemUrl(customAppUrl) || customAppUrl, 'custom')}
                    disabled={!customAppUrl.trim()}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {copiedKey === 'custom' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'custom' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                  {isValidHttpUrl(customAppUrl) && (
                    <a
                      href={normalizeSystemUrl(customAppUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิด</span>
                    </a>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                หากระบุ Custom Domain ระบบจะใช้เป็นลิงก์หลักอันดับแรกสำหรับแชร์และสรุปรายงาน
              </p>
            </div>

            {/* Quick Team Share Message Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" /> ข้อความส่งต่อลิงก์ระบบให้ทีมงาน (LINE / Email)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(shareMessagePreview, 'shareMsg')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {copiedKey === 'shareMsg' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>คัดลอกข้อความแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอกข้อความแชร์</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap break-all bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                {shareMessagePreview}
              </pre>
            </div>
          </div>

          {/* Card 2: Connected Cloud & Database Service Links */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 min-w-0 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>ลิงก์เชื่อมต่อบริการคลาวด์และฐานข้อมูล (Live Sync Links)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  แก้ไขอัปเดตลิงก์ Google Sheets, Google Drive และ Cloudflare Worker ที่ระบบใช้งานจริง
                </p>
              </div>

              {/* Google Sheets Link / ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ลิงก์ Google Sheets หรือ Spreadsheet ID</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="วางลิงก์ https://docs.google.com/spreadsheets/d/... หรือ ID"
                    className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(liveSheetUrl, 'sheet')}
                      disabled={!liveSheetUrl}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      {copiedKey === 'sheet' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'sheet' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                    {liveSheetUrl && (
                      <a
                        href={liveSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิด Sheet</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                  <span>Spreadsheet ID ปัจจุบัน:</span>
                  <code className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-mono break-all">
                    {extractedSheetIdPreview || 'ยังไม่ได้เชื่อม Google Sheet'}
                  </code>
                </div>
              </div>

              {/* Google Drive Folder URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FolderSync className="w-3.5 h-3.5 text-blue-400" />
                  <span>ลิงก์โฟลเดอร์เก็บเอกสาร & โฉนด (Google Drive Folder URL)</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={driveFolderUrl}
                    onChange={(e) => setDriveFolderUrl(e.target.value)}
                    placeholder="เช่น https://drive.google.com/drive/folders/..."
                    className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(liveDriveUrl, 'drive')}
                      disabled={!liveDriveUrl}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      {copiedKey === 'drive' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'drive' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                    {liveDriveUrl && (
                      <a
                        href={liveDriveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิด Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Cloudflare Worker API Endpoint */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cloudflare Worker API Endpoint URL (เชื่อม Hybrid D1)</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={workerUrl}
                    onChange={(e) => setWorkerUrl(e.target.value)}
                    placeholder="เช่น https://land-portfolio-api.yoursubdomain.workers.dev"
                    className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(liveWorkerUrl, 'worker')}
                      disabled={!liveWorkerUrl}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      {copiedKey === 'worker' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'worker' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                    {liveWorkerUrl && (
                      <a
                        href={liveWorkerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>ทดสอบ</span>
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  ซิงค์ตรงกับค่า Worker URL ในแท็บ Hybrid Architecture โดยอัตโนมัติ
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกและอัปเดตลิงก์ระบบทั้งหมด</span>
            </button>
          </div>
        </div>
      </form>

      {/* Section 3: Custom System & Team Resource Links (CRUD) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
              <Link2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>คลังลิงก์ระบบ & ทรัพยากรสำคัญ ({links.length} ลิงก์)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              เพิ่ม แก้ไข ลบ และปักหมุดลิงก์ที่ใช้งานบ่อย (ลิงก์ที่ปักหมุดจะแสดงในเมนูลิงก์ด่วนบนแถบด้านบนทุกหน้า)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreStarterLinks}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>เติมลิงก์กรมที่ดิน/ธนารักษ์</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (showAddForm && !editingLinkId) {
                  resetLinkForm();
                } else {
                  setEditingLinkId(null);
                  setLinkLabel('');
                  setLinkUrl('');
                  setLinkCategory('team_resource');
                  setLinkDescription('');
                  setLinkPinned(true);
                  setLinkFormError(null);
                  setShowAddForm(true);
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>เพิ่มลิงก์ระบบใหม่</span>
            </button>
          </div>
        </div>

        {/* Add / Edit Custom Link Form */}
        {showAddForm && (
          <form
            onSubmit={handleSaveCustomLink}
            className="p-4 sm:p-5 rounded-xl bg-slate-950/70 border border-emerald-500/40 space-y-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-emerald-400">
                {editingLinkId ? 'แก้ไขลิงก์ระบบ' : 'เพิ่มลิงก์ใหม่เข้าระบบ'}
              </span>
              <button
                type="button"
                onClick={resetLinkForm}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="ปิดฟอร์ม"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {linkFormError && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{linkFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ชื่อลิงก์ <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="เช่น โฟลเดอร์สัญญาซื้อขาย / ระบบนายหน้า / กลุ่ม LINE"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  หมวดหมู่ลิงก์
                </label>
                <select
                  value={linkCategory}
                  onChange={(e) => setLinkCategory(e.target.value as SystemLinkCategory)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {SYSTEM_LINK_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.labelThai}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">
                  URL เว็บไซต์ / ลิงก์ปลายทาง <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">
                  คำอธิบายเพิ่มเติม (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="รายละเอียดสั้นๆ เพื่อช่วยให้ทีมงานเข้าใจการใช้งานลิงก์นี้"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={linkPinned}
                  onChange={(e) => setLinkPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
                <span>ปักหมุดไว้ในเมนูลิงก์ด่วนบนแถบนำทางด้านบน (Pin to Quick Links)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetLinkForm}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingLinkId ? 'บันทึกการแก้ไข' : 'เพิ่มลิงก์'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อลิงก์, URL หรือคำอธิบาย..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as SystemLinkCategory | 'all')
            }
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">ทุกหมวดหมู่ ({links.length})</option>
            {SYSTEM_LINK_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.labelThai}
              </option>
            ))}
          </select>
        </div>

        {/* Links List */}
        {filteredLinks.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs sm:text-sm">
            ไม่พบลิงก์ในหมวดหมู่หรือคำค้นหานี้ — กดปุ่ม &quot;เพิ่มลิงก์ระบบใหม่&quot; เพื่อสร้างลิงก์ของคุณเอง
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredLinks.map((item) => {
              const catMeta = getCategoryMeta(item.category);
              const safeHref = normalizeSystemUrl(item.url);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl bg-slate-950/70 border transition-all flex flex-col justify-between gap-3 min-w-0 ${
                    item.isPinned
                      ? 'border-emerald-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {item.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                            <Pin className="w-2.5 h-2.5" /> ปักหมุด
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${catMeta.badgeClass}`}
                        >
                          {catMeta.labelThai}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePin(item.id)}
                        className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors shrink-0 ${
                          item.isPinned
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                        title={item.isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุดไว้ในเมนูลิงก์ด่วน'}
                      >
                        {item.isPinned ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <h4 className="font-bold text-white text-sm leading-snug break-words">
                      {item.label}
                    </h4>

                    {item.description && (
                      <p className="text-[11px] text-slate-400 leading-relaxed break-words">
                        {item.description}
                      </p>
                    )}

                    {safeHref ? (
                      <a
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-sky-400 hover:text-sky-300 hover:underline block truncate"
                        title={safeHref}
                      >
                        {safeHref}
                      </a>
                    ) : (
                      <span className="text-[11px] font-mono text-rose-400 block truncate">
                        URL ไม่ถูกต้อง: {item.url}
                      </span>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      {safeHref && (
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>เปิดลิงก์</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy(safeHref || item.url, `item-${item.id}`)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `item-${item.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอก</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditLink(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>แก้ไข</span>
                      </button>

                      {pendingDeleteId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(item.id)}
                            className="px-2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            ยืนยันลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(item.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 cursor-pointer transition-colors"
                          title="ลบลิงก์นี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
