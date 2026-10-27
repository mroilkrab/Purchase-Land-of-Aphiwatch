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
  Moon
} from 'lucide-react';
import { PortfolioSettings, AppFontSize } from '../types/land';

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
}) => {
  const [showFontMenu, setShowFontMenu] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  // Close font menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setShowFontMenu(false);
      }
    };
    if (showFontMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFontMenu]);

  const currentIndex = FONT_OPTIONS.findIndex((f) => f.id === fontSize);
  const currentOption = FONT_OPTIONS[currentIndex >= 0 ? currentIndex : 1];

  const handleStepFont = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIdx = Math.max(0, Math.min(FONT_OPTIONS.length - 1, (currentIndex >= 0 ? currentIndex : 1) + delta));
    onFontSizeChange(FONT_OPTIONS[newIdx].id);
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
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
                <span className="font-bold text-sm sm:text-base text-white tracking-tight truncate">
                  {settings.portfolioTitle || 'ระบบจัดการที่ดิน'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Sparkles className="w-3 h-3 mr-1" /> Live Portfolio
                </span>
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

            {/* Add Plot Button */}
            <button
              onClick={onAddNewPlot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มแปลงที่ดิน</span>
            </button>

            {/* Google Auth Status */}
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
                  <div className="text-xs font-medium text-slate-200 truncate max-w-[110px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center">
                    <CloudCheck className="w-3 h-3 mr-1" /> ซิงค์อัตโนมัติ
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
    </header>
  );
};
