import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  Building2, 
  LayoutDashboard, 
  Table, 
  Calculator, 
  FileText, 
  Settings, 
  PlusCircle, 
  CloudCheck, 
  LogIn, 
  LogOut,
  Sparkles,
  MapPin,
  BarChart3,
  Type,
  ChevronDown,
  Check,
  Sun,
  Moon,
  RefreshCw,
  Link2,
  ExternalLink,
  Copy,
  FileSpreadsheet,
  FolderSync
} from 'lucide-react';
import { PortfolioSettings, AppFontSize } from '../types/land';
import { DEFAULT_SYSTEM_LINKS } from '../data/defaultLandData';
import { getUserRole, ROLE_DEFINITIONS } from '../services/rbac';
import {
  buildGoogleSheetUrl,
  copyTextSafely,
  getPrimarySystemUrl,
  normalizeSystemUrl,
} from '../utils/systemLinks';

interface NavbarProps {
  activeTab: 'dashboard' | 'table' | 'map' | 'reports' | 'simulator' | 'artifact' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'table' | 'map' | 'reports' | 'simulator' | 'artifact' | 'settings') => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onAddNewPlot: () => void;
  settings: PortfolioSettings;
  fontSize: AppFontSize;
  onFontSizeChange: (size: AppFontSize) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isSyncing?: boolean;
  sheetSyncStatus?: {
    status: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
    sheetUrl?: string;
    lastSynced?: string;
  } | null;
  onOpenSystemLinks?: () => void;
}

const FONT_OPTIONS: { id: AppFontSize; label: string; percent: string; desc: string }[] = [
  { id: 'sm', label: 'กะทัดรัด', percent: '88%', desc: 'ข้อมูลจุใจ เหมาะกับตารางกว้าง' },
  { id: 'base', label: 'มาตรฐาน', percent: '100%', desc: 'ขนาดเริ่มต้น สบายตา' },
  { id: 'lg', label: 'ตัวหนังสือใหญ่', percent: '113%', desc: 'อ่านง่าย ชัดเจน' },
  { id: 'xl', label: 'ใหญ่พิเศษ', percent: '125%', desc: 'ตัวโตพิเศษ มองเห็นชัดเจน' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogin,
  onLogout,
  onAddNewPlot,
  settings,
  fontSize,
  onFontSizeChange,
  theme,
  onToggleTheme,
  isSyncing,
  sheetSyncStatus,
  onOpenSystemLinks,
}) => {
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showLinksMenu, setShowLinksMenu] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const linksMenuRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setShowFontMenu(false);
      }
      if (linksMenuRef.current && !linksMenuRef.current.contains(event.target as Node)) {
        setShowLinksMenu(false);
      }
    };
    if (showFontMenu || showLinksMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFontMenu, showLinksMenu]);

  const handleQuickCopyLink = async (url: string, key: string) => {
    const ok = await copyTextSafely(url);
    if (ok) {
      setCopiedLinkId(key);
      setTimeout(() => setCopiedLinkId((prev) => (prev === key ? null : prev)), 2000);
    }
  };

  const primaryAppUrl = getPrimarySystemUrl(settings);
  const activeSheetUrl = buildGoogleSheetUrl(settings.googleSheetId);
  const activeDriveUrl = normalizeSystemUrl(settings.googleDriveFolderUrl || '');
  const pinnedLinks = (settings.systemLinks ?? DEFAULT_SYSTEM_LINKS).filter(
    (l) => l.isPinned && normalizeSystemUrl(l.url)
  );

  const currentIndex = FONT_OPTIONS.findIndex((f) => f.id === fontSize);
  const currentOption = FONT_OPTIONS[currentIndex >= 0 ? currentIndex : 1];

  const handleStepFont = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIdx = Math.max(0, Math.min(FONT_OPTIONS.length - 1, (currentIndex >= 0 ? currentIndex : 1) + delta));
    onFontSizeChange(FONT_OPTIONS[newIdx].id);
  };

  const currentUserRole = getUserRole(user, settings);
  const roleDef = ROLE_DEFINITIONS[currentUserRole];

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md relative">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Brand Logo & Name */}
          <div 
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer min-w-0" 
            onClick={() => setActiveTab('table')}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm sm:text-base text-white tracking-tight truncate font-sans">
                  {settings.portfolioTitle || 'ระบบจัดการที่ดิน'}
                </span>

                {/* Live Sync Status Chip or Live Portfolio badge */}
                {isSyncing ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse shadow-sm shadow-emerald-500/10 shrink-0">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[120px] sm:max-w-none">
                      {sheetSyncStatus?.message && sheetSyncStatus.status === 'syncing' 
                        ? sheetSyncStatus.message 
                        : 'กำลังซิงค์ Google Sheets...'}
                    </span>
                  </span>
                ) : (
                  <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Sparkles className="w-3 h-3 mr-1" /> Live Portfolio
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                พอร์ตการลงทุนที่ดิน: {settings.ownerName || 'อภิวัชร์'} • Hybrid Cloud & Map
              </p>
            </div>
          </div>

          {/* Controls: Font Size Switcher + Add Plot + Google Account */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Font Size Switcher */}
            <div className="relative" ref={fontMenuRef}>
              <div className="inline-flex items-center bg-slate-800/90 border border-slate-700/80 rounded-lg p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={(e) => handleStepFont(-1, e)}
                  disabled={currentIndex <= 0}
                  className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded text-xs font-bold disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                  title="ลดขนาดตัวอักษร (A-)"
                  aria-label="Decrease Font Size"
                >
                  A-
                </button>

                <button
                  type="button"
                  onClick={() => setShowFontMenu(!showFontMenu)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/60 rounded transition-colors cursor-pointer"
                  title="ปรับขนาดตัวอักษรของระบบ"
                  aria-label="Font Size Menu"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span className="font-mono text-[11px]">{currentOption.percent}</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                <button
                  type="button"
                  onClick={(e) => handleStepFont(1, e)}
                  disabled={currentIndex >= FONT_OPTIONS.length - 1}
                  className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded text-xs font-bold disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                  title="เพิ่มขนาดตัวอักษร (A+)"
                  aria-label="Increase Font Size"
                >
                  A+
                </button>
              </div>

              {/* Font Size Dropdown Popover */}
              {showFontMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>ปรับขนาดตัวอักษร (Font Size)</span>
                    <span className="font-mono text-emerald-400">{currentOption.percent}</span>
                  </div>
                  <div className="p-1 space-y-0.5">
                    {FONT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onFontSizeChange(opt.id);
                          setShowFontMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                          fontSize === opt.id
                            ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{opt.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              {opt.percent}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {opt.desc}
                          </div>
                        </div>
                        {fontSize === opt.id && (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Theme Switcher Button (โหมดสว่าง / โหมดมืด) */}
            <button
              type="button"
              onClick={onToggleTheme}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium shadow-sm ${
                theme === 'light'
                  ? 'bg-amber-500/15 text-amber-600 border-amber-400/40 hover:bg-amber-500/25'
                  : 'bg-slate-800/90 text-amber-300 border-slate-700/80 hover:bg-slate-700/80'
              }`}
              title={theme === 'light' ? 'เปลี่ยนเป็นโหมดมืด (Dark Mode)' : 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)'}
              aria-label="Toggle Light and Dark Theme"
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 shrink-0 animate-spin-slow" />
                  <span className="hidden xl:inline text-[11px] font-semibold">โหมดสว่าง</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="hidden xl:inline text-[11px] font-semibold">โหมดมืด</span>
                </>
              )}
            </button>

            {/* Quick System Links & Share Popover */}
            <div className="relative" ref={linksMenuRef}>
              <button
                type="button"
                onClick={() => setShowLinksMenu(!showLinksMenu)}
                className="p-2 rounded-lg border bg-slate-800/90 text-emerald-400 border-slate-700/80 hover:bg-slate-700/80 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium shadow-sm"
                title="ลิงก์ระบบและทางลัดที่ใช้งานจริง (System Links)"
                aria-label="System Quick Links"
              >
                <Link2 className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline text-[11px] font-semibold">ลิงก์ระบบ</span>
              </button>

              {showLinksMenu && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                      ลิงก์ระบบที่ใช้งานจริง
                    </span>
                    {onOpenSystemLinks && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowLinksMenu(false);
                          onOpenSystemLinks();
                        }}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold cursor-pointer"
                      >
                        แก้ไข / จัดการลิงก์
                      </button>
                    )}
                  </div>

                  {/* Primary App URL */}
                  {primaryAppUrl && (
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-semibold text-emerald-400">
                        ลิงก์เข้าแอปหลัก (แชร์ให้ทีม)
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 truncate" title={primaryAppUrl}>
                        {primaryAppUrl}
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleQuickCopyLink(primaryAppUrl, 'nav-app')}
                          className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {copiedLinkId === 'nav-app' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>คัดลอกลิงก์</span>
                            </>
                          )}
                        </button>
                        <a
                          href={primaryAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>เปิด</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Connected Cloud Links */}
                  {(activeSheetUrl || activeDriveUrl) && (
                    <div className="space-y-1.5">
                      {activeSheetUrl && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <a
                            href={activeSheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-emerald-400 min-w-0 truncate"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">Google Sheets บัญชีที่ดิน</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleQuickCopyLink(activeSheetUrl, 'nav-sheet')}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
                            title="คัดลอกลิงก์ Google Sheet"
                          >
                            {copiedLinkId === 'nav-sheet' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {activeDriveUrl && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <a
                            href={activeDriveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-blue-400 min-w-0 truncate"
                          >
                            <FolderSync className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">Google Drive เอกสารโฉนด</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleQuickCopyLink(activeDriveUrl, 'nav-drive')}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
                            title="คัดลอกลิงก์ Drive"
                          >
                            {copiedLinkId === 'nav-drive' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pinned Custom Links */}
                  {pinnedLinks.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-800">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-0.5">
                        ลิงก์ปักหมุด ({pinnedLinks.length})
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                        {pinnedLinks.map((item) => {
                          const href = normalizeSystemUrl(item.url);
                          if (!href) return null;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/80 transition-colors"
                            >
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-emerald-400 min-w-0 truncate"
                              >
                                <ExternalLink className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleQuickCopyLink(href, `nav-${item.id}`)}
                                className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
                                title="คัดลอกลิงก์"
                              >
                                {copiedLinkId === `nav-${item.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {onOpenSystemLinks && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowLinksMenu(false);
                        onOpenSystemLinks();
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>อัปเดต & จัดการลิงก์ระบบทั้งหมด</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Add Plot Button */}
            <button
              onClick={onAddNewPlot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มแปลงที่ดิน</span>
            </button>

            {/* Google Auth Status & User Role Badge */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google Account'}
                    className="w-8 h-8 rounded-full border border-emerald-500/40 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs border border-slate-700 shrink-0">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[95px]">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${roleDef.colorBadge} hover:opacity-80 transition-opacity cursor-pointer`}
                      title="สิทธิ์การใช้งานของคุณ - คลิกเพื่อไปที่หน้าจัดการสิทธิ์"
                    >
                      {currentUserRole === 'owner' ? 'Owner' : currentUserRole === 'editor' ? 'Editor' : 'Viewer'}
                    </button>
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center">
                    <CloudCheck className="w-3 h-3 mr-1" /> ซิงค์ทีมคลาวด์
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title="ออกจากระบบ Google"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">เชื่อมต่อ Google</span>
              </button>
            )}

          </div>
        </div>

        {/* Tab Navigation with clean horizontal scrolling and no page blowout */}
        <nav className="flex space-x-1 sm:space-x-1.5 border-t border-slate-800/60 overflow-x-auto py-1.5 scrollbar-none max-w-full">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'table'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            ตารางข้อมูล & บัญชีซื้อขาย
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            แดชบอร์ด & KPI
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            แผนที่พิกัดดาวเทียม (Map)
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            รายงานกำไรขาดทุน (Reports)
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            จำลองราคา & กำไร (KPI)
          </button>

          <button
            onClick={() => setActiveTab('artifact')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'artifact'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Live Artifact (สรุปพอร์ต)
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            ตั้งค่า & สำรองข้อมูล Hybrid
          </button>
        </nav>
      </div>

      {/* Persistent Subtle Synchronizing Progress Bar for background operations */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-[2.5px] overflow-hidden transition-all duration-300 z-50 ${
          isSyncing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        role="progressbar"
        aria-label="Google Sheets Synchronizing Progress"
        aria-busy={isSyncing}
      >
        <div className="absolute inset-0 bg-emerald-950/40" />
        <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-300 to-cyan-400 w-full animate-indeterminate-stream animate-pulse-glow" />
      </div>
    </header>
  );
};
