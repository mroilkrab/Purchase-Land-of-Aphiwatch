import React from 'react';
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
  Sparkles
} from 'lucide-react';
import { PortfolioSettings } from '../types/land';

interface NavbarProps {
  activeTab: 'dashboard' | 'table' | 'simulator' | 'artifact' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'table' | 'simulator' | 'artifact' | 'settings') => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onAddNewPlot: () => void;
  settings: PortfolioSettings;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogin,
  onLogout,
  onAddNewPlot,
  settings,
  isSyncing,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">
                  {settings.portfolioTitle || 'ระบบจัดการที่ดิน'}
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3 mr-1" /> Live Portfolio
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                พอร์ตการลงทุนที่ดิน: {settings.ownerName || 'อภิวัชร์'} • Hybrid Storage
              </p>
            </div>
          </div>

          {/* Quick Action + Google Account */}
          <div className="flex items-center gap-3">
            <button
              onClick={onAddNewPlot}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มแปลงที่ดิน</span>
            </button>

            {/* Google Auth Status */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google Account'}
                    className="w-8 h-8 rounded-full border border-emerald-500/40"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs border border-slate-700">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center">
                    <CloudCheck className="w-3 h-3 mr-1" /> เชื่อมต่อแล้ว
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">เชื่อมต่อ Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-800/60 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            แดชบอร์ด & KPI
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'table'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Table className="w-4 h-4" />
            ตารางข้อมูล & บัญชีซื้อขาย
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-4 h-4" />
            จำลองราคา & กำไร (KPI)
          </button>

          <button
            onClick={() => setActiveTab('artifact')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'artifact'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            Live Artifact (สรุปพอร์ต)
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            ตั้งค่า & สำรองข้อมูล Hybrid
          </button>
        </nav>
      </div>
    </header>
  );
};
