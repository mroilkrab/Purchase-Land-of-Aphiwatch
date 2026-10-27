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
 * Ensures a dedicated folder for an individual land plot inside the main Land Portfolio folder
 * Example: "Land_Portfolio_Manager / [แปลงที่ 01] ที่ดินสันทราย เชียงใหม่"
 */
export const ensureLandPlotDriveFolder = async (
  accessToken: string,
  plotOrderNumber: number,
  plotTitle: string,
  mainFolderName: string = 'Land_Portfolio_Manager'
): Promise<{ folderId: string; webViewLink: string } | null> => {
  try {
    const parentFolderId = await ensureDriveFolder(accessToken, mainFolderName);
    const sanitizedTitle = (plotTitle || 'ไม่ระบุชื่อแปลง').replace(/['"]/g, '').trim();
    const subfolderName = `[แปลงที่ ${plotOrderNumber.toString().padStart(2, '0')}] ${sanitizedTitle}`;

    // Search for existing subfolder inside parent
    let query = `name = '${subfolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const existing = searchData.files[0];
        return {
          folderId: existing.id,
          webViewLink: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
        };
      }
    }

    // Create new plot subfolder
    const metaPayload: { name: string; mimeType: string; parents?: string[] } = {
      name: subfolderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      metaPayload.parents = [parentFolderId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaPayload),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return {
        folderId: folderData.id,
        webViewLink: folderData.webViewLink || `https://drive.google.com/drive/folders/${folderData.id}`,
      };
    }

    return null;
  } catch (err: any) {
    console.error('Failed to ensure land plot Drive folder:', err);
    return null;
  }
};

/**
 * Uploads an image (base64 Data URL) directly into the plot's Google Drive folder
 */
export const uploadPlotImageToDrive = async (
  accessToken: string,
  folderId: string,
  imageDataUrl: string,
  imageName: string
): Promise<{ fileId: string; fileName: string; webViewLink?: string; thumbnailLink?: string }> => {
  // Extract mime type and binary content from data url
  const matches = imageDataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let base64Data = imageDataUrl;

  if (matches && matches.length === 3) {
    mimeType = matches[1];
    base64Data = matches[2];
  }

  // Convert base64 to binary ArrayBuffer
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const cleanFileName = imageName.endsWith('.jpg') || imageName.endsWith('.png') 
    ? imageName 
    : `${imageName}_${Date.now().toString().slice(-4)}.jpg`;

  const metadata = {
    name: cleanFileName,
    mimeType: mimeType,
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846Img';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n';
  const imageHeaderPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  
  // Combine multipart payload
  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadataPart);
  const imageHeaderBuffer = encoder.encode(imageHeaderPart);
  const closeBuffer = encoder.encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    metadataBuffer.length + imageHeaderBuffer.length + bytes.length + closeBuffer.length
  );
  fullPayload.set(metadataBuffer, 0);
  fullPayload.set(imageHeaderBuffer, metadataBuffer.length);
  fullPayload.set(bytes, metadataBuffer.length + imageHeaderBuffer.length);
  fullPayload.set(closeBuffer, metadataBuffer.length + imageHeaderBuffer.length + bytes.length);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'ไม่สามารถอัปโหลดรูปภาพไปยัง Google Drive ได้');
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    fileName: result.name || cleanFileName,
    webViewLink: result.webViewLink,
    thumbnailLink: result.thumbnailLink,
  };
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
