import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  loadPlotsFromStorage, 
  savePlotsToStorage, 
  loadSettingsFromStorage, 
  saveSettingsToStorage, 
  resetDataToDefault, 
  calculateKPIs,
  exportToCsvFile,
  loadPlotsFromIndexedDB,
  loadSettingsFromIndexedDB
} from './services/storage';
import { 
  initAuth, 
  googleSignIn, 
  logoutGoogle, 
  getAccessToken, 
  getSheetsAccessToken, 
  hasGrantedSheetsScope, 
  connectGoogleSheetsScope, 
  isInsufficientScopesError, 
  GoogleAuthErrorInfo, 
  parseGoogleAuthError 
} from './services/firebaseAuth';

import { createGoogleSheet, updateExistingGoogleSheet } from './services/googleSheets';
import { LandPlot, PortfolioSettings, AppFontSize } from './types/land';
import { getUserRole, hasPermission } from './services/rbac';
import { Navbar } from './components/Navbar';

import { KPIDashboard } from './components/KPIDashboard';
import { LandTable } from './components/LandTable';
import { LandMapView } from './components/LandMapView';
import { ReportsView } from './components/ReportsView';
import { KPISimulator } from './components/KPISimulator';
import { LiveArtifactView } from './components/LiveArtifactView';
import { SettingsAndBackup } from './components/SettingsAndBackup';
import { LandFormModal } from './components/LandFormModal';
import { LandDetailModal } from './components/LandDetailModal';
import { GoogleAuthTroubleshootModal } from './components/GoogleAuthTroubleshootModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuickActionFab } from './components/QuickActionFab';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [plots, setPlots] = useState<LandPlot[]>(() => loadPlotsFromStorage());
  const [settings, setSettings] = useState<PortfolioSettings>(() => loadSettingsFromStorage());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'map' | 'reports' | 'simulator' | 'artifact' | 'settings'>('table');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<LandPlot | null>(null);
  const [selectedPlotForDetail, setSelectedPlotForDetail] = useState<LandPlot | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('all');
  const [authErrorInfo, setAuthErrorInfo] = useState<GoogleAuthErrorInfo | null>(null);
  const [isAuthTroubleshootOpen, setIsAuthTroubleshootOpen] = useState(false);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hydrate full data with unstripped images from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    loadPlotsFromIndexedDB().then((dbPlots) => {
      if (isMounted && dbPlots && dbPlots.length > 0) {
        setPlots(dbPlots);
      }
    }).catch((err) => {
      console.warn('Initial IndexedDB plots hydration note:', err);
    });

    loadSettingsFromIndexedDB().then((dbSettings) => {
      if (isMounted && dbSettings) {
        setSettings((prev) => ({ ...prev, ...dbSettings }));
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Theme synchronization
  useEffect(() => {
    const currentTheme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [settings.theme]);

  const handleToggleTheme = () => {
    const nextTheme: 'dark' | 'light' = settings.theme === 'light' ? 'dark' : 'light';
    const updated: PortfolioSettings = { ...settings, theme: nextTheme };
    setSettings(updated);
    saveSettingsToStorage(updated);
    showToast(nextTheme === 'light' ? '☀️ เปิดใช้งานโหมดสว่าง (Light Mode)' : '🌙 เปิดใช้งานโหมดมืด (Dark Mode)');
  };

  // Google Sheet Sync State
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<{
    status: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
    sheetUrl?: string;
    lastSynced?: string;
  }>({
    status: 'idle',
    message: settings.googleSheetId
      ? 'เชื่อมต่อ Google Sheet แล้ว ข้อมูลจะซิงค์อัตโนมัติเมื่อ เพิ่ม, แก้ไข หรือ ลบ'
      : 'เข้าสู่ระบบ Google เพื่อเปิดใช้งานระบบอัปเดต Google Sheet อัตโนมัติ',
    sheetUrl: settings.googleSheetId ? `https://docs.google.com/spreadsheets/d/${settings.googleSheetId}` : undefined,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync HTML font scale attribute and style whenever settings.fontSize changes
  useEffect(() => {
    const size = settings.fontSize || 'base';
    document.documentElement.setAttribute('data-font-size', size);
    const fontSizeMap: Record<string, string> = {
      sm: '87.5%',
      base: '100%',
      lg: '112.5%',
      xl: '125%',
    };
    document.documentElement.style.fontSize = fontSizeMap[size] || '100%';
  }, [settings.fontSize]);

  const handleFontSizeChange = (size: AppFontSize) => {
    const updated = { ...settings, fontSize: size };
    setSettings(updated);
    saveSettingsToStorage(updated);
    const labelMap: Record<string, string> = {
      sm: 'กะทัดรัด (88%)',
      base: 'มาตรฐาน (100%)',
      lg: 'ตัวหนังสือใหญ่ (113%)',
      xl: 'ใหญ่พิเศษ (125%)',
    };
    showToast(`ปรับขนาดตัวอักษรเป็น: ${labelMap[size] || size}`);
  };

  // Background Auto-sync to Google Sheets on any Add, Edit, or Delete
  const syncPlotsToGoogleSheet = async (
    currentPlots: LandPlot[],
    actionLabel: string,
    explicitToken?: string
  ) => {
    if (!settings.googleSheetId && !explicitToken) return;

    let token = explicitToken || (await getSheetsAccessToken());
    if (!token) {
      setSheetSyncStatus((prev) => ({
        ...prev,
        message: 'บันทึกในระบบแล้ว (เข้าสู่ระบบ Google เพื่ออัปเดต Google Sheet อัตโนมัติ)',
      }));
      return;
    }

    try {
      setIsSyncingSheet(true);
      setSheetSyncStatus((prev) => ({
        ...prev,
        status: 'syncing',
        message: `กำลังอัปเดต Google Sheet (${actionLabel})...`,
      }));

      let currentSheetId = settings.googleSheetId;
      let spreadsheetUrl = '';

      if (currentSheetId) {
        try {
          const res = await updateExistingGoogleSheet(token, currentSheetId, currentPlots, settings);
          spreadsheetUrl = res.spreadsheetUrl;
        } catch (updateErr: any) {
          if (isInsufficientScopesError(updateErr)) {
            throw updateErr;
          }
          console.warn('Update existing sheet failed, attempting fallback create:', updateErr);
          if (
            updateErr.message?.includes('404') ||
            updateErr.message?.includes('not found') ||
            updateErr.message?.includes('400') ||
            updateErr.message?.includes('Unable to parse range')
          ) {
            const res = await createGoogleSheet(token, currentPlots, settings);
            currentSheetId = res.spreadsheetId;
            spreadsheetUrl = res.spreadsheetUrl;
            const newSettings = { ...settings, googleSheetId: currentSheetId };
            setSettings(newSettings);
            saveSettingsToStorage(newSettings);
          } else {
            throw updateErr;
          }
        }
      } else {
        const res = await createGoogleSheet(token, currentPlots, settings);
        currentSheetId = res.spreadsheetId;
        spreadsheetUrl = res.spreadsheetUrl;
        const newSettings = { ...settings, googleSheetId: currentSheetId };
        setSettings(newSettings);
        saveSettingsToStorage(newSettings);
      }

      const timeStr = new Date().toLocaleTimeString('th-TH');
      setSheetSyncStatus({
        status: 'success',
        message: `อัปเดต Google Sheet อัตโนมัติแล้ว (${actionLabel}) เวลา ${timeStr}`,
        sheetUrl: spreadsheetUrl,
        lastSynced: timeStr,
      });
      showToast(`✅ ${actionLabel} และอัปเดต Google Sheet เรียบร้อยแล้ว!`);
    } catch (err: any) {
      console.error('Google Sheets sync error:', err);
      const isScopeErr = isInsufficientScopesError(err);
      const errMsg = isScopeErr
        ? 'บัญชี Google ยังไม่ได้อนุญาตสิทธิ์ Google Sheets (กดยืนยันสิทธิ์ Google Sheets เพื่อเริ่มการซิงค์)'
        : (err.message || 'โปรดตรวจสอบการเชื่อมต่อ');

      setSheetSyncStatus((prev) => ({
        ...prev,
        status: 'error',
        message: isScopeErr
          ? '⚠️ ยังไม่ได้รับสิทธิ์ Google Sheets: กรุณากดปุ่ม "เชื่อมต่อสิทธิ์ Google Sheets"'
          : `ไม่สามารถอัปเดต Google Sheet ได้: ${errMsg}`,
      }));
      showToast(`⚠️ ${actionLabel} ในระบบแล้ว แต่ซิงค์ Google Sheet ไม่สำเร็จ: ${errMsg}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleManualSyncSheet = async () => {
    try {
      setIsSyncingSheet(true);
      if (!user) {
        await handleLogin();
        return;
      }

      // Check if we have granted sheets scope yet
      let token = await getSheetsAccessToken();
      const hasScope = hasGrantedSheetsScope();

      // If user hasn't granted sheets scope yet, prompt directly on this click!
      if (!token || !hasScope) {
        showToast('🔑 กรุณากดยืนยันอนุญาตสิทธิ์ Google Sheets ในหน้าต่างป๊อปอัป...');
        const authRes = await googleSignIn({ requestSheetsScope: true });
        token = authRes?.accessToken || null;
        if (!token) {
          setIsSyncingSheet(false);
          return;
        }
      }

      try {
        await syncPlotsToGoogleSheet(plots, 'ซิงค์ข้อมูลทั้งหมด', token);
      } catch (err: any) {
        if (isInsufficientScopesError(err)) {
          showToast('🔑 บัญชียังไม่ได้อนุญาตสิทธิ์ Google Sheets: กำลังเปิดหน้าต่างขอสิทธิ์...');
          const authRes = await googleSignIn({ requestSheetsScope: true });
          if (authRes?.accessToken) {
            await syncPlotsToGoogleSheet(plots, 'ซิงค์ข้อมูลทั้งหมด', authRes.accessToken);
          }
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      console.error('Manual sync error:', err);
      const parsed = parseGoogleAuthError(err);
      if (parsed.isUnverifiedApp) {
        setAuthErrorInfo(parsed);
        setIsAuthTroubleshootOpen(true);
      }
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleConnectSheetsScope = async () => {
    try {
      showToast('🔑 กำลังเปิดหน้าต่างยืนยันสิทธิ์ Google Sheets & Drive...');
      const token = await connectGoogleSheetsScope();
      if (token) {
        showToast('✅ เชื่อมต่อและอนุญาตสิทธิ์ Google Sheets สำเร็จ! กำลังเริ่มซิงค์ข้อมูล...');
        await syncPlotsToGoogleSheet(plots, 'เชื่อมต่อสิทธิ์สำเร็จ ซิงค์ข้อมูล', token);
      }
    } catch (err: any) {
      console.error('Connect sheets scope error:', err);
      const parsed = parseGoogleAuthError(err);
      if (parsed.isUnverifiedApp) {
        setAuthErrorInfo(parsed);
        setIsAuthTroubleshootOpen(true);
      } else if (!parsed.isCancelled) {
        showToast(`⚠️ ขอสิทธิ์ Google Sheets ไม่สำเร็จ: ${parsed.title}`);
      }
    }
  };


  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser: User) => {
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
        setAuthErrorInfo(null);
        setIsAuthTroubleshootOpen(false);
        showToast(`ยินดีต้อนรับคุณ ${res.user.displayName || res.user.email}`);
        // If we have plots, offer or perform initial sync
        syncPlotsToGoogleSheet(plots, 'เข้าสู่ระบบสำเร็จ ซิงค์ข้อมูล');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const parsedInfo = err.authErrorInfo || parseGoogleAuthError(err);
      setAuthErrorInfo(parsedInfo);
      if (!parsedInfo.isCancelled) {
        setIsAuthTroubleshootOpen(true);
      }
      showToast(`⚠️ ${parsedInfo.title}`);
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

  // Plot operations with RBAC permission enforcement
  const currentUserRole = getUserRole(user, settings);

  const handleSavePlot = (savedPlot: LandPlot) => {
    if (!hasPermission(currentUserRole, 'canEdit')) {
      showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ดูและพิมพ์รายงานได้เท่านั้น ไม่สามารถแก้ไขข้อมูลได้');
      return;
    }
    let updatedList: LandPlot[];
    const exists = plots.some((p) => p.id === savedPlot.id);

    if (exists) {
      updatedList = plots.map((p) => (p.id === savedPlot.id ? savedPlot : p));
      showToast(`บันทึกการแก้ไขแปลง #${savedPlot.orderNumber} เรียบร้อยแล้ว`);
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

    // Auto-update Google Sheet
    syncPlotsToGoogleSheet(
      updatedList,
      exists ? `แก้ไขแปลง #${savedPlot.orderNumber}` : `เพิ่มแปลงใหม่ #${savedPlot.orderNumber}`
    );
  };

  const handleDeletePlot = (plotId: string) => {
    if (!hasPermission(currentUserRole, 'canDelete')) {
      showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ไม่สามารถลบแปลงที่ดินได้');
      return;
    }
    const targetPlot = plots.find((p) => p.id === plotId);
    const updated = plots.filter((p) => p.id !== plotId);
    setPlots(updated);
    savePlotsToStorage(updated);
    if (selectedPlotForDetail?.id === plotId) {
      setSelectedPlotForDetail(null);
    }
    showToast(`ลบแปลงที่ดิน #${targetPlot?.orderNumber || ''} ออกจากระบบแล้ว`);

    // Auto-update Google Sheet after deletion
    syncPlotsToGoogleSheet(updated, `ลบแปลง #${targetPlot?.orderNumber || ''}`);
  };

  const handleDuplicatePlot = (plot: LandPlot) => {
    if (!hasPermission(currentUserRole, 'canCreate')) {
      showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ไม่สามารถเพิ่มหรือทำสำเนาแปลงที่ดินได้');
      return;
    }
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

    // Auto-update Google Sheet after duplication
    syncPlotsToGoogleSheet(updated, `เพิ่มแปลงสำเนา #${nextOrder}`);
  };

  const handleResetData = () => {

    const { plots: defPlots, settings: defSettings } = resetDataToDefault();
    setPlots(defPlots);
    setSettings(defSettings);
    showToast('คืนค่าข้อมูลเริ่มต้น 10 แปลงตามตารางของคุณอภิวัชร์แล้ว');
    syncPlotsToGoogleSheet(defPlots, 'คืนค่าข้อมูลเริ่มต้น 10 แปลง');
  };

  const handleImportPlots = (importedPlots: LandPlot[], importedSettings?: PortfolioSettings) => {
    setPlots(importedPlots);
    savePlotsToStorage(importedPlots);
    if (importedSettings) {
      setSettings(importedSettings);
      saveSettingsToStorage(importedSettings);
    }
    showToast(`นำเข้าข้อมูลที่ดินสำเร็จ ${importedPlots.length} รายการ`);
    syncPlotsToGoogleSheet(importedPlots, `นำเข้าข้อมูล ${importedPlots.length} แปลง`);
  };

  const handleUpdateSettings = (newSettings: PortfolioSettings) => {
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
    showToast('บันทึกการตั้งค่าระบบเรียบร้อย');
    syncPlotsToGoogleSheet(plots, 'อัปเดตการตั้งค่าระบบ');
  };

  const kpis = calculateKPIs(plots);
  const nextOrderNumber = Math.max(...plots.map((p) => p.orderNumber || 0), 0) + 1;

  return (
    <div className="min-h-screen bg-[#0c121e] text-slate-100 flex flex-col font-['IBM_Plex_Sans_Thai','Plus_Jakarta_Sans','Prompt',sans-serif] overflow-x-hidden max-w-full app-container transition-colors duration-200">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onAddNewPlot={() => {
          if (!hasPermission(currentUserRole, 'canCreate')) {
            showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ดูและพิมพ์รายงาน A4 ได้เท่านั้น');
            return;
          }
          setEditingPlot(null);
          setIsFormOpen(true);
        }}
        settings={settings}
        fontSize={settings.fontSize || 'base'}
        onFontSizeChange={handleFontSizeChange}
        theme={settings.theme || 'dark'}
        onToggleTheme={handleToggleTheme}
        isSyncing={isSyncingSheet}
        sheetSyncStatus={sheetSyncStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 min-w-0">
        {activeTab === 'dashboard' && (
          <KPIDashboard
            plots={plots}
            kpis={kpis}
            settings={settings}
            onNavigateToSimulator={() => setActiveTab('simulator')}
            onNavigateToTable={() => setActiveTab('table')}
            onNavigateToMap={() => setActiveTab('map')}
            onNavigateToReports={() => setActiveTab('reports')}
            onSelectPlot={(plot) => setSelectedPlotForDetail(plot)}
            onFilterTable={(query) => {
              if (query === 'holding') {
                setTableStatusFilter('holding');
                setTableSearchQuery('');
              } else {
                setTableSearchQuery(query);
              }
              setActiveTab('table');
            }}
          />
        )}

        {activeTab === 'table' && (
          <LandTable
            plots={plots}
            initialSearchTerm={tableSearchQuery}
            initialStatusFilter={tableStatusFilter}
            onSelectPlot={(plot) => setSelectedPlotForDetail(plot)}
            onEditPlot={(plot) => {
              if (!hasPermission(currentUserRole, 'canEdit')) {
                showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ดูและพิมพ์รายงานได้เท่านั้น');
                return;
              }
              setEditingPlot(plot);
              setIsFormOpen(true);
            }}
            onDeletePlot={handleDeletePlot}
            onDuplicatePlot={handleDuplicatePlot}
            onAddNewPlot={() => {
              if (!hasPermission(currentUserRole, 'canCreate')) {
                showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ไม่สามารถเพิ่มแปลงที่ดินได้');
                return;
              }
              setEditingPlot(null);
              setIsFormOpen(true);
            }}
            onExportCsv={() => exportToCsvFile(plots, settings)}
            isSyncingSheet={isSyncingSheet}
            sheetSyncStatus={sheetSyncStatus}
            onSyncSheet={handleManualSyncSheet}
            googleSheetId={settings.googleSheetId}
            isGoogleAuthed={!!user}
            onLoginGoogle={handleLogin}
            settings={settings}
            userRole={currentUserRole}
            onConnectSheetsScope={handleConnectSheetsScope}
          />
        )}



        {activeTab === 'map' && (
          <LandMapView
            plots={plots}
            onSelectPlot={(plot) => setSelectedPlotForDetail(plot)}
            onEditPlot={(plot) => {
              setEditingPlot(plot);
              setIsFormOpen(true);
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            plots={plots}
            settings={settings}
            onSelectPlot={(plot) => setSelectedPlotForDetail(plot)}
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
            onNavigateToTable={() => setActiveTab('table')}
            onOpenGoogleAuthTroubleshoot={() => setIsAuthTroubleshootOpen(true)}
          />
        )}
      </main>

      {/* Form Modal (Add / Edit) */}
      {isFormOpen && (
        <ErrorBoundary
          fallbackTitle="เกิดข้อผิดพลาดในการเปิดฟอร์มแก้ไขแปลงที่ดิน"
          onReset={() => {
            setIsFormOpen(false);
            setEditingPlot(null);
          }}
        >
          <LandFormModal
            key={editingPlot ? editingPlot.id : `new-${nextOrderNumber}`}
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false);
              setEditingPlot(null);
            }}
            onSave={handleSavePlot}
            onDelete={handleDeletePlot}
            initialData={editingPlot}
            nextOrderNumber={nextOrderNumber}
            isGoogleAuthed={!!user}
            googleSheetId={settings.googleSheetId}
            onLoginGoogle={handleLogin}
            isSyncingSheet={isSyncingSheet}
            sheetSyncStatus={sheetSyncStatus}
          />
        </ErrorBoundary>
      )}

      {/* Detail Modal */}
      {selectedPlotForDetail && (
        <ErrorBoundary
          fallbackTitle="เกิดข้อผิดพลาดในการเปิดหน้ารายละเอียดแปลงที่ดิน"
          onReset={() => setSelectedPlotForDetail(null)}
        >
          <LandDetailModal
            key={selectedPlotForDetail.id}
            plot={selectedPlotForDetail}
            onClose={() => setSelectedPlotForDetail(null)}
            onEdit={(plot) => {
              setSelectedPlotForDetail(null);
              setEditingPlot(plot);
              setIsFormOpen(true);
            }}
            onDelete={(plot) => {
              handleDeletePlot(plot.id);
            }}
            onSimulate={(plot) => {
              setSelectedPlotForDetail(null);
              setActiveTab('simulator');
            }}
            onUpdatePlot={handleSavePlot}
            settings={settings}
            user={user}
            onLoginGoogle={handleLogin}
          />
        </ErrorBoundary>
      )}

      {/* Google Auth Troubleshoot Modal for Vercel / Custom Domains */}
      <GoogleAuthTroubleshootModal
        isOpen={isAuthTroubleshootOpen}
        onClose={() => setIsAuthTroubleshootOpen(false)}
        errorInfo={authErrorInfo}
        onRetry={handleLogin}
      />

      {/* Quick Action Floating Action Button (FAB) on Dashboard and Table views */}
      {(activeTab === 'dashboard' || activeTab === 'table') && (
        <QuickActionFab
          onAddNewPlot={() => {
            if (!hasPermission(currentUserRole, 'canCreate')) {
              showToast('⚠️ สิทธิ์ของคุณคือ ผู้เข้าชม (Viewer) - ดูและพิมพ์รายงาน A4 ได้เท่านั้น');
              return;
            }
            setEditingPlot(null);
            setIsFormOpen(true);
          }}
          onGenerateReport={() => {
            setActiveTab('reports');
            showToast('📄 เปิดหน้าพิมพ์รายงานและสรุปข้อมูล A4 แล้ว');
          }}
          onSyncSheet={handleManualSyncSheet}
          onOpenMap={() => setActiveTab('map')}
          isSyncingSheet={isSyncingSheet}
          canCreate={hasPermission(currentUserRole, 'canCreate')}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 sm:left-auto sm:right-24 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium shadow-2xl shadow-emerald-600/40 animate-fade-in border border-emerald-400/30">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
