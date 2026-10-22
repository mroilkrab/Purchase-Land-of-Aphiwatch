import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  loadPlotsFromStorage, 
  savePlotsToStorage, 
  loadSettingsFromStorage, 
  saveSettingsToStorage, 
  resetDataToDefault, 
  calculateKPIs,
  exportToCsvFile
} from './services/storage';
import { initAuth, googleSignIn, logoutGoogle } from './services/firebaseAuth';
import { LandPlot, PortfolioSettings } from './types/land';
import { Navbar } from './components/Navbar';
import { KPIDashboard } from './components/KPIDashboard';
import { LandTable } from './components/LandTable';
import { KPISimulator } from './components/KPISimulator';
import { LiveArtifactView } from './components/LiveArtifactView';
import { SettingsAndBackup } from './components/SettingsAndBackup';
import { LandFormModal } from './components/LandFormModal';
import { LandDetailModal } from './components/LandDetailModal';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [plots, setPlots] = useState<LandPlot[]>(() => loadPlotsFromStorage());
  const [settings, setSettings] = useState<PortfolioSettings>(() => loadSettingsFromStorage());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'simulator' | 'artifact' | 'settings'>('dashboard');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<LandPlot | null>(null);
  const [selectedPlotForDetail, setSelectedPlotForDetail] = useState<LandPlot | null>(null);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
      },
      () => {
        setUser(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setUser(res.user);
        showToast(`ยินดีต้อนรับคุณ ${res.user.displayName || res.user.email}`);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast('ไม่สามารถเชื่อมต่อบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
      setUser(null);
      showToast('ออกจากระบบเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Plot operations
  const handleSavePlot = (savedPlot: LandPlot) => {
    let updatedList: LandPlot[];
    const exists = plots.some((p) => p.id === savedPlot.id);

    if (exists) {
      updatedList = plots.map((p) => (p.id === savedPlot.id ? savedPlot : p));
      showToast(`บันทึกข้อมูลแปลง #${savedPlot.orderNumber} เรียบร้อยแล้ว`);
    } else {
      updatedList = [...plots, savedPlot];
      showToast(`เพิ่มแปลงใหม่ #${savedPlot.orderNumber} สำเร็จ`);
    }

    setPlots(updatedList);
    savePlotsToStorage(updatedList);
    setIsFormOpen(false);
    setEditingPlot(null);

    // If detail modal is open for this plot, update it too
    if (selectedPlotForDetail?.id === savedPlot.id) {
      setSelectedPlotForDetail(savedPlot);
    }
  };

  const handleDeletePlot = (plotId: string) => {
    const updated = plots.filter((p) => p.id !== plotId);
    setPlots(updated);
    savePlotsToStorage(updated);
    if (selectedPlotForDetail?.id === plotId) {
      setSelectedPlotForDetail(null);
    }
    showToast('ลบแปลงที่ดินออกจากระบบแล้ว');
  };

  const handleDuplicatePlot = (plot: LandPlot) => {
    const nextOrder = Math.max(...plots.map((p) => p.orderNumber), 0) + 1;
    const duplicated: LandPlot = {
      ...plot,
      id: `plot-${Date.now()}`,
      orderNumber: nextOrder,
      title: `${plot.title} (สำเนา)`,
      status: 'holding',
      saleDate: '',
      soldPrice: 0,
      netReceived: 0,
      updatedAt: new Date().toISOString(),
    };
    const updated = [...plots, duplicated];
    setPlots(updated);
    savePlotsToStorage(updated);
    showToast(`คัดลอกเป็นแปลง #${nextOrder} สำเร็จ`);
  };

  const handleResetData = () => {
    const { plots: defPlots, settings: defSettings } = resetDataToDefault();
    setPlots(defPlots);
    setSettings(defSettings);
    showToast('คืนค่าข้อมูลเริ่มต้น 10 แปลงตามตารางของคุณอภิวัชร์แล้ว');
  };

  const handleImportPlots = (importedPlots: LandPlot[], importedSettings?: PortfolioSettings) => {
    setPlots(importedPlots);
    savePlotsToStorage(importedPlots);
    if (importedSettings) {
      setSettings(importedSettings);
      saveSettingsToStorage(importedSettings);
    }
    showToast(`นำเข้าข้อมูลที่ดินสำเร็จ ${importedPlots.length} รายการ`);
  };

  const handleUpdateSettings = (newSettings: PortfolioSettings) => {
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
    showToast('บันทึกการตั้งค่าระบบเรียบร้อย');
  };

  const kpis = calculateKPIs(plots);
  const nextOrderNumber = Math.max(...plots.map((p) => p.orderNumber || 0), 0) + 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Prompt',sans-serif]">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onAddNewPlot={() => {
          setEditingPlot(null);
          setIsFormOpen(true);
        }}
        settings={settings}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <KPIDashboard
            plots={plots}
            kpis={kpis}
            settings={settings}
            onNavigateToSimulator={() => setActiveTab('simulator')}
            onNavigateToTable={() => setActiveTab('table')}
            onSelectPlot={(plot) => setSelectedPlotForDetail(plot)}
          />
        )}

        {activeTab === 'table' && (
          <LandTable
            plots={plots}
            onSelectPlot={(plot) => setSelectedPlotForDetail(plot)}
            onEditPlot={(plot) => {
              setEditingPlot(plot);
              setIsFormOpen(true);
            }}
            onDeletePlot={handleDeletePlot}
            onDuplicatePlot={handleDuplicatePlot}
            onAddNewPlot={() => {
              setEditingPlot(null);
              setIsFormOpen(true);
            }}
            onExportCsv={() => exportToCsvFile(plots, settings)}
          />
        )}

        {activeTab === 'simulator' && (
          <KPISimulator
            plots={plots}
            settings={settings}
            onUpdatePlot={handleSavePlot}
          />
        )}

        {activeTab === 'artifact' && (
          <LiveArtifactView
            plots={plots}
            kpis={kpis}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsAndBackup
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            plots={plots}
            onResetData={handleResetData}
            onImportPlots={handleImportPlots}
            user={user}
            onLoginGoogle={handleLogin}
          />
        )}
      </main>

      {/* Form Modal (Add / Edit) */}
      <LandFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPlot(null);
        }}
        onSave={handleSavePlot}
        initialData={editingPlot}
        nextOrderNumber={nextOrderNumber}
      />

      {/* Detail Modal */}
      <LandDetailModal
        plot={selectedPlotForDetail}
        onClose={() => setSelectedPlotForDetail(null)}
        onEdit={(plot) => {
          setSelectedPlotForDetail(null);
          setEditingPlot(plot);
          setIsFormOpen(true);
        }}
        onSimulate={(plot) => {
          setSelectedPlotForDetail(null);
          setActiveTab('simulator');
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium shadow-2xl shadow-emerald-600/40 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
