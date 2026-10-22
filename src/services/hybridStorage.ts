import { LandPlot, PortfolioSettings } from '../types/land';
import { savePlotsToStorage, saveSettingsToStorage } from './storage';
import { getAccessToken } from './firebaseAuth';
import { ensureDriveFolder, uploadJsonSnapshotToDrive } from './googleDrive';
import { createGoogleSheet, updateExistingGoogleSheet } from './googleSheets';
import { CloudflareD1Config, syncWithCloudflareD1 } from './cloudflareD1';

export interface HybridSyncResult {
  local: { success: boolean; message: string };
  googleDrive: { success: boolean; message: string; fileId?: string; folderId?: string; webViewLink?: string };
  googleSheets: { success: boolean; message: string; spreadsheetUrl?: string };
  cloudflareD1: { success: boolean; message: string; mode: 'remote' | 'simulated' };
  timestamp: string;
}

/**
 * Runs a complete 3-Tier Hybrid Synchronization across Local, Cloudflare D1, and Google Drive & Sheets
 */
export const runHybridSync = async (
  plots: LandPlot[],
  settings: PortfolioSettings,
  d1Config: CloudflareD1Config
): Promise<HybridSyncResult> => {
  const timestamp = new Date().toLocaleString('th-TH');

  const result: HybridSyncResult = {
    local: { success: false, message: '' },
    googleDrive: { success: false, message: '' },
    googleSheets: { success: false, message: '' },
    cloudflareD1: { success: false, message: '', mode: 'simulated' },
    timestamp,
  };

  // 1. Tier 1: Local Storage (Instant & Offline-first)
  try {
    savePlotsToStorage(plots);
    saveSettingsToStorage(settings);
    result.local = {
      success: true,
      message: `บันทึกข้อมูลในเครื่อง (Local Storage) เรียบร้อยแล้ว (${plots.length} แปลง)`,
    };
  } catch (err: any) {
    result.local = {
      success: false,
      message: `บันทึกลง Local Storage ล้มเหลว: ${err.message}`,
    };
  }

  // 2. Tier 2: Cloudflare D1 via Worker (Edge SQL Database)
  try {
    const d1Res = await syncWithCloudflareD1(d1Config, plots, settings);
    result.cloudflareD1 = {
      success: d1Res.success,
      message: d1Res.message,
      mode: d1Res.mode,
    };
  } catch (err: any) {
    result.cloudflareD1 = {
      success: false,
      message: `Cloudflare D1 Error: ${err.message}`,
      mode: 'remote',
    };
  }

  // 3. Tier 3: Google Drive & Google Sheets (Cloud File Archive & Spreadsheets)
  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      // 3A. Google Drive Snapshot
      try {
        let folderId: string | null = null;
        try {
          folderId = await ensureDriveFolder(accessToken, 'Land_Portfolio_Manager');
        } catch (e) {
          console.warn('Could not ensure Drive folder, uploading to Drive root:', e);
        }
        const driveUpload = await uploadJsonSnapshotToDrive(accessToken, folderId, plots, settings);
        result.googleDrive = {
          success: true,
          message: `อัปโหลดไฟล์สำรองเข้า Google Drive สำเร็จ (${driveUpload.fileName})`,
          fileId: driveUpload.fileId,
          folderId: folderId || undefined,
          webViewLink: driveUpload.webViewLink,
        };
      } catch (driveErr: any) {
        result.googleDrive = {
          success: false,
          message: `Google Drive: ${driveErr.message || 'ซิงค์ไม่สำเร็จ'}`,
        };
      }

      // 3B. Google Sheets Sync
      try {
        if (settings.googleSheetId) {
          const sheetRes = await updateExistingGoogleSheet(accessToken, settings.googleSheetId, plots, settings);
          result.googleSheets = {
            success: true,
            message: `อัปเดต Google Sheet (${sheetRes.updatedRows} แถว) เรียบร้อย`,
            spreadsheetUrl: sheetRes.spreadsheetUrl,
          };
        } else {
          const sheetRes = await createGoogleSheet(accessToken, plots, settings);
          result.googleSheets = {
            success: true,
            message: `สร้างและส่งออก Google Sheet ใหม่สำเร็จ`,
            spreadsheetUrl: sheetRes.spreadsheetUrl,
          };
        }
      } catch (sheetErr: any) {
        result.googleSheets = {
          success: false,
          message: `Google Sheets Error: ${sheetErr.message}`,
        };
      }
    } else {
      result.googleDrive = {
        success: false,
        message: 'ยังไม่ได้เข้าสู่ระบบ Google (กดปุ่ม "เชื่อมต่อ Google" เพื่อเปิดใช้งาน Google Drive)',
      };
      result.googleSheets = {
        success: false,
        message: 'ยังไม่ได้เข้าสู่ระบบ Google',
      };
    }
  } catch (authErr: any) {
    result.googleDrive = { success: false, message: authErr.message };
    result.googleSheets = { success: false, message: authErr.message };
  }

  return result;
};
