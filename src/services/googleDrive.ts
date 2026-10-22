import { LandPlot, PortfolioSettings } from '../types/land';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  size?: string;
}

/**
 * Searches for an existing folder or creates a new one in Google Drive
 */
export const ensureDriveFolder = async (
  accessToken: string,
  folderName: string = 'Land_Portfolio_Manager'
): Promise<string | null> => {
  try {
    // 1. Search for existing folder
    const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    } else if (searchRes.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }

    // 2. Create new folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    } else if (createRes.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }

    return null;
  } catch (err: any) {
    if (err.message && err.message.includes('เซสชัน Google หมดอายุ')) {
      throw err;
    }
    console.warn('Could not ensure Drive folder, will upload to Drive root:', err);
    return null;
  }
};

/**
 * Uploads a JSON backup snapshot file into Google Drive (in folder or Drive root)
 */
export const uploadJsonSnapshotToDrive = async (
  accessToken: string,
  folderId: string | null | undefined,
  plots: LandPlot[],
  settings: PortfolioSettings
): Promise<{ fileId: string; fileName: string; webViewLink?: string }> => {
  const fileName = `Land_Portfolio_Backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
  const fileContent = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      owner: settings.ownerName || 'อภิวัชร์',
      portfolioTitle: settings.portfolioTitle,
      plotsCount: plots.length,
      settings,
      plots,
    },
    null,
    2
  );

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: fileName,
    mimeType: 'application/json',
  };

  // Only assign parents if valid folderId is present
  if (folderId && folderId.trim()) {
    metadata.parents = [folderId.trim()];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'ไม่สามารถอัปโหลดไฟล์สำรองไปยัง Google Drive ได้');
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    fileName: result.name || fileName,
    webViewLink: result.webViewLink,
  };
};

/**
 * Lists backed up portfolio files inside the Google Drive folder or root
 */
export const listDriveFolderFiles = async (
  accessToken: string,
  folderId?: string | null
): Promise<DriveFileItem[]> => {
  try {
    const query = folderId && folderId.trim()
      ? encodeURIComponent(`'${folderId.trim()}' in parents and trashed = false`)
      : encodeURIComponent(`name contains 'Land_Portfolio_Backup' and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink,createdTime,size)&orderBy=createdTime desc`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
  }
};
