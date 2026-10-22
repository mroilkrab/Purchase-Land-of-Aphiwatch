import { LandPlot, PortfolioSettings } from '../types/land';

export interface ExportToSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  updatedRows: number;
}

/**
 * Converts LandPlot array to Google Sheets rows matching the user's attachment structure
 */
export const formatLandPlotsForSheet = (
  plots: LandPlot[],
  settings: PortfolioSettings
): (string | number)[][] => {
  const rows: (string | number)[][] = [];

  // Title header row
  rows.push([settings.portfolioTitle || `รายละเอียดการซื้อที่ดิน - ${settings.ownerName || 'อภิวัชร์'}`]);

  // Grand total summary row
  const totalCostSum = plots.reduce((acc, p) => acc + (p.totalCost || 0), 0);
  const row2: (string | number)[] = Array(17).fill('');
  row2[17] = totalCostSum.toLocaleString('th-TH');
  rows.push(row2);

  // Column header row 1
  rows.push([
    'ลำดับ',
    'วันที่ซื้อ',
    'วันที่ขาย',
    'รายละเอียดที่ดิน',
    'ประเภท',
    'ตำบล/แขวง',
    'อำเภอ/เขต',
    'จังหวัด',
    'เลขที่ดิน',
    'ตำแหน่งที่ดิน (Maps)',
    'ไร่',
    'งาน',
    'ตารางวา',
    'รวมจำนวนที่ดิน(ไร่)',
    'รวมจำนวนที่ดิน(ตร.ว.)',
    'ไร่ละ',
    'ตารางวาละ',
    'ราคารวม/ราคาซื้อ',
    'จ่ายค่าธรรมเนียม/ค่าอากร/ภาษี',
    'จ่ายค่ารังวัด',
    'จ่ายค่าใช้จ่ายอื่นๆ',
    'รวมทั้งสิ้น/ทั้งหมด',
    'ราคาที่ตั้งใจจะขาย (KPI)',
    'ราคาที่ขายได้',
    'ค่าคอมมิชชั่น',
    'สุทธิที่ได้รับ',
    'สถานะ',
    'หมายเหตุเพิ่มเติม',
  ]);

  // Data rows
  plots.forEach((plot) => {
    // If the plot has multiple sub-parcels, we output the parent plot row and sub rows
    if (plot.subParcels && plot.subParcels.length > 1) {
      // First parcel row
      const firstSp = plot.subParcels[0];
      rows.push([
        plot.orderNumber,
        plot.purchaseDate || '-',
        plot.saleDate || (plot.status === 'sold' ? 'ขายแล้ว' : ''),
        plot.title,
        plot.landType,
        plot.subdistrict,
        plot.district,
        plot.province,
        firstSp.deedNumber || plot.primaryDeedNumber,
        firstSp.mapsUrl || plot.mapsUrl,
        firstSp.rai,
        firstSp.ngan,
        firstSp.sqWah,
        plot.totalRai,
        plot.totalSqWah,
        plot.pricePerRai ? plot.pricePerRai.toLocaleString('th-TH') : '-',
        plot.pricePerSqWah ? plot.pricePerSqWah.toLocaleString('th-TH') : '-',
        plot.purchasePrice ? plot.purchasePrice.toLocaleString('th-TH') : '-',
        plot.taxAndFees ? plot.taxAndFees.toLocaleString('th-TH') : '-',
        plot.surveyCost ? plot.surveyCost.toLocaleString('th-TH') : '-',
        plot.otherExpenses ? plot.otherExpenses.toLocaleString('th-TH') : '-',
        plot.totalCost ? plot.totalCost.toLocaleString('th-TH') : '-',
        plot.targetSalePrice ? plot.targetSalePrice.toLocaleString('th-TH') : '-',
        plot.soldPrice ? plot.soldPrice.toLocaleString('th-TH') : '-',
        plot.commissionFee ? plot.commissionFee.toLocaleString('th-TH') : '-',
        plot.netReceived ? plot.netReceived.toLocaleString('th-TH') : '-',
        getStatusLabel(plot.status),
        plot.notes || '',
      ]);

      // Subsequent sub-parcels
      for (let i = 1; i < plot.subParcels.length; i++) {
        const sp = plot.subParcels[i];
        rows.push([
          '', // ลำดับ
          '', // วันที่ซื้อ
          '', // วันที่ขาย
          '', // รายละเอียด
          '', // ประเภท
          plot.subdistrict,
          plot.district,
          plot.province,
          sp.deedNumber,
          sp.mapsUrl || '',
          sp.rai,
          sp.ngan,
          sp.sqWah,
          '',
          sp.totalSqWah,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          sp.notes || '',
        ]);
      }
    } else {
      // Single parcel plot
      rows.push([
        plot.orderNumber,
        plot.purchaseDate || '-',
        plot.saleDate || (plot.status === 'sold' ? 'ขายแล้ว' : ''),
        plot.title,
        plot.landType,
        plot.subdistrict,
        plot.district,
        plot.province,
        plot.primaryDeedNumber,
        plot.mapsUrl,
        plot.rai,
        plot.ngan,
        plot.sqWah,
        plot.totalRai,
        plot.totalSqWah,
        plot.pricePerRai ? plot.pricePerRai.toLocaleString('th-TH') : '-',
        plot.pricePerSqWah ? plot.pricePerSqWah.toLocaleString('th-TH') : '-',
        plot.purchasePrice ? plot.purchasePrice.toLocaleString('th-TH') : '-',
        plot.taxAndFees ? plot.taxAndFees.toLocaleString('th-TH') : '-',
        plot.surveyCost ? plot.surveyCost.toLocaleString('th-TH') : '-',
        plot.otherExpenses ? plot.otherExpenses.toLocaleString('th-TH') : '-',
        plot.totalCost ? plot.totalCost.toLocaleString('th-TH') : '-',
        plot.targetSalePrice ? plot.targetSalePrice.toLocaleString('th-TH') : '-',
        plot.soldPrice ? plot.soldPrice.toLocaleString('th-TH') : '-',
        plot.commissionFee ? plot.commissionFee.toLocaleString('th-TH') : '-',
        plot.netReceived ? plot.netReceived.toLocaleString('th-TH') : '-',
        getStatusLabel(plot.status),
        plot.notes || '',
      ]);
    }
  });

  return rows;
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'holding':
      return 'ถือครอง';
    case 'for_sale':
      return 'กำลังประกาศขาย';
    case 'sold':
      return 'ขายแล้ว';
    case 'consignment':
      return 'รับขายฝาก';
    default:
      return status;
  }
};

/**
 * Helper to extract spreadsheet ID if user pastes full Google Sheet URL
 */
export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  return trimmed;
};

/**
 * Retrieves the actual title of the first worksheet in the spreadsheet
 * (prevents 'Unable to parse range: Sheet1!A1' when the tab is named ชีต1, แผ่นงาน1, etc.)
 */
export const getFirstSheetTitle = async (
  accessToken: string,
  spreadsheetId: string
): Promise<string> => {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets(properties(sheetId,title))`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.sheets && data.sheets.length > 0 && data.sheets[0].properties?.title) {
        return data.sheets[0].properties.title;
      }
    } else if (res.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }
  } catch (err: any) {
    if (err.message && err.message.includes('เซสชัน Google หมดอายุ')) throw err;
    console.warn('Could not inspect sheet title, defaulting to fallback:', err);
  }
  return 'รายละเอียดที่ดิน';
};

/**
 * Creates a new Google Spreadsheet and writes land data
 */
export const createGoogleSheet = async (
  accessToken: string,
  plots: LandPlot[],
  settings: PortfolioSettings
): Promise<ExportToSheetResult> => {
  const title = `${settings.portfolioTitle || 'รายละเอียดการซื้อที่ดิน'} (${new Date().toLocaleDateString('th-TH')})`;
  const sheetTabTitle = 'รายละเอียดที่ดิน';

  // 1. Create spreadsheet with explicitly defined sheet tab name
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: sheetTabTitle,
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    if (createRes.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create sheet: ${createRes.statusText}`);
  }

  const createData = await createRes.json();
  const spreadsheetId = createData.spreadsheetId;
  const spreadsheetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // 2. Format values
  const values = formatLandPlotsForSheet(plots, settings);

  // 3. Write data to the created sheet tab with properly quoted range
  const targetRange = `'${sheetTabTitle}'!A1`;
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: targetRange,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!updateRes.ok) {
    if (updateRes.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to populate sheet data: ${updateRes.statusText}`);
  }

  const updateData = await updateRes.json();

  return {
    spreadsheetId,
    spreadsheetUrl,
    updatedRows: updateData.updatedRows || values.length,
  };
};

/**
 * Updates an existing Google Spreadsheet by ID or URL
 */
export const updateExistingGoogleSheet = async (
  accessToken: string,
  spreadsheetIdOrUrl: string,
  plots: LandPlot[],
  settings: PortfolioSettings
): Promise<ExportToSheetResult> => {
  const cleanId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!cleanId) {
    throw new Error('กรุณาระบุ Google Spreadsheet ID หรือ URL ให้ถูกต้อง');
  }

  // 1. Inspect actual sheet title dynamically (e.g. ชีต1, แผ่นงาน1, Sheet1, รายละเอียดที่ดิน)
  const sheetTitle = await getFirstSheetTitle(accessToken, cleanId);
  const values = formatLandPlotsForSheet(plots, settings);

  const clearRange = `'${sheetTitle}'!A1:Z1000`;
  const targetRange = `'${sheetTitle}'!A1`;

  // 2. Clear existing content in the sheet
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(clearRange)}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (clearErr) {
    console.warn('Could not clear sheet beforehand, overwriting directly:', clearErr);
  }

  // 3. Update with fresh values
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: targetRange,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!updateRes.ok) {
    if (updateRes.status === 401) {
      throw new Error('เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง');
    }
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update sheet: ${updateRes.statusText}`);
  }

  const updateData = await updateRes.json();

  return {
    spreadsheetId: cleanId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}`,
    updatedRows: updateData.updatedRows || values.length,
  };
};
