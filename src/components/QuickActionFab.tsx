import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  X, 
  FileText, 
  PlusCircle, 
  FileSpreadsheet, 
  MapPin, 
  RefreshCw, 
  Sparkles,
  Printer,
  ChevronRight
} from 'lucide-react';

interface QuickActionFabProps {
  onAddNewPlot: () => void;
  onGenerateReport: () => void;
  onSyncSheet?: () => void;
  onOpenMap?: () => void;
  isSyncingSheet?: boolean;
  canCreate?: boolean;
}

export const QuickActionFab: React.FC<QuickActionFabProps> = ({
  onAddNewPlot,
  onGenerateReport,
  onSyncSheet,
  onOpenMap,
  isSyncingSheet = false,
  canCreate = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close speed dial on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <div 
      ref={containerRef} 
      className="fixed bottom-6 right-6 z-40 print:hidden flex flex-col items-end select-none"
    >
      {/* Dimmed backdrop when speed dial is open */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-200 z-30"
          aria-hidden="true"
        />
      )}

      {/* Speed Dial Menu Items */}
      <div 
        className={`flex flex-col items-end gap-3 mb-3 z-40 transition-all duration-200 ${
          isOpen 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Action 1: Add New Plot */}
        <div className="flex items-center gap-3 group">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/95 text-slate-100 text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-md whitespace-nowrap group-hover:border-emerald-500/50 group-hover:text-emerald-300 transition-colors">
            เพิ่มแปลงที่ดินใหม่ (Add New Plot)
          </span>
          <button
            type="button"
            onClick={() => handleAction(onAddNewPlot)}
            disabled={!canCreate}
            className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border border-emerald-400/30 transition-transform active:scale-95 hover:scale-105 cursor-pointer disabled:opacity-50"
            title="เพิ่มแปลงที่ดินใหม่"
            aria-label="Add New Plot"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Action 2: Generate Report */}
        <div className="flex items-center gap-3 group">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/95 text-slate-100 text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-md whitespace-nowrap group-hover:border-blue-500/50 group-hover:text-blue-300 transition-colors">
            สร้างรายงาน & พิมพ์ A4 (Generate Report)
          </span>
          <button
            type="button"
            onClick={() => handleAction(onGenerateReport)}
            className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 border border-blue-400/30 transition-transform active:scale-95 hover:scale-105 cursor-pointer"
            title="สร้างและพิมพ์รายงาน A4"
            aria-label="Generate Report"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>

        {/* Action 3: Sync Google Sheets (if handler provided) */}
        {onSyncSheet && (
          <div className="flex items-center gap-3 group">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/95 text-slate-100 text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-md whitespace-nowrap group-hover:border-teal-500/50 group-hover:text-teal-300 transition-colors">
              {isSyncingSheet ? 'กำลังซิงค์ Google Sheets...' : 'ซิงค์ Google Sheets ทันที'}
            </span>
            <button
              type="button"
              onClick={() => handleAction(onSyncSheet)}
              disabled={isSyncingSheet}
              className="w-11 h-11 rounded-full bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 border border-teal-400/30 transition-transform active:scale-95 hover:scale-105 cursor-pointer disabled:opacity-50"
              title="ซิงค์ข้อมูลไปยัง Google Sheets"
              aria-label="Sync Google Sheet"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* Action 4: Open Map View (if handler provided) */}
        {onOpenMap && (
          <div className="flex items-center gap-3 group">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/95 text-slate-100 text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-md whitespace-nowrap group-hover:border-amber-500/50 group-hover:text-amber-300 transition-colors">
              ดูแผนที่แปลงที่ดิน (Map View)
            </span>
            <button
              type="button"
              onClick={() => handleAction(onOpenMap)}
              className="w-11 h-11 rounded-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-600/30 border border-amber-400/30 transition-transform active:scale-95 hover:scale-105 cursor-pointer"
              title="เปิดดูแผนที่พิกัดที่ดิน"
              aria-label="Open Map View"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 ${
          isOpen
            ? 'bg-slate-800 text-rose-400 border border-slate-700 rotate-90 scale-105 shadow-rose-500/10'
            : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white border border-emerald-400/40 shadow-emerald-600/40 hover:scale-105'
        }`}
        title={isOpen ? 'ปิดเมนูด่วน' : 'เมนูลัด (Quick Actions)'}
        aria-label="Quick Actions Floating Button"
        aria-expanded={isOpen}
      >
        {/* Glow Ring pulse when closed */}
        {!isOpen && (
          <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping opacity-60 pointer-events-none" />
        )}

        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-200" />
        ) : (
          <Plus className="w-7 h-7 transition-transform duration-200" />
        )}
      </button>
    </div>
  );
};
