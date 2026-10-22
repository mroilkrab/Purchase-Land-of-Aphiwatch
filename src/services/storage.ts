import { LandPlot, PortfolioSettings, KPIStats } from '../types/land';
import { INITIAL_LAND_PLOTS, DEFAULT_SETTINGS } from '../data/defaultLandData';

const PLOTS_STORAGE_KEY = 'land_portfolio_plots_v1';
const SETTINGS_STORAGE_KEY = 'land_portfolio_settings_v1';

export const loadPlotsFromStorage = (): LandPlot[] => {
  try {
    const raw = localStorage.getItem(PLOTS_STORAGE_KEY);
    if (!raw) {
      savePlotsToStorage(INITIAL_LAND_PLOTS);
      return INITIAL_LAND_PLOTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_LAND_PLOTS;
  } catch (e) {
    console.error('Failed to load plots from local storage:', e);
    return INITIAL_LAND_PLOTS;
  }
};

export const savePlotsToStorage = (plots: LandPlot[]) => {
  try {
    localStorage.setItem(PLOTS_STORAGE_KEY, JSON.stringify(plots));
  } catch (e) {
    console.error('Failed to save plots to local storage:', e);
  }
};

export const loadSettingsFromStorage = (): PortfolioSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      saveSettingsToStorage(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load settings:', e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettingsToStorage = (settings: PortfolioSettings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

export const resetDataToDefault = (): { plots: LandPlot[]; settings: PortfolioSettings } => {
  savePlotsToStorage(INITIAL_LAND_PLOTS);
  saveSettingsToStorage(DEFAULT_SETTINGS);
  return { plots: INITIAL_LAND_PLOTS, settings: DEFAULT_SETTINGS };
};

export const exportToJsonFile = (plots: LandPlot[], settings: PortfolioSettings) => {
  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    settings,
    plots,
  };
  const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', jsonStr);
  dlAnchor.setAttribute('download', `land_portfolio_backup_${new Date().toISOString().slice(0, 10)}.json`);
  dlAnchor.click();
};

export const exportToCsvFile = (plots: LandPlot[], settings: PortfolioSettings) => {
  const headers = [
    'ลำดับ',
    'วันที่ซื้อ',
    'วันที่ขาย',
    'รายละเอียดที่ดิน',
    'ประเภท',
    'ตำบล/แขวง',
    'อำเภอ/เขต',
    'จังหวัด',
    'เลขที่ดิน',
    'ตำแหน่งที่ดิน',
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
    'ราคาที่ตั้งใจจะขาย',
    'ราคาที่ขายได้',
    'ค่าคอมมิชชั่น',
    'สุทธิที่ได้รับ',
    'สถานะ',
    'หมายเหตุเพิ่มเติม',
  ];

  const lines: string[] = [];
  lines.push(`"${settings.portfolioTitle || 'รายละเอียดการซื้อที่ดิน - อภิวัชร์'}"`);
  lines.push(headers.map((h) => `"${h}"`).join(','));

  plots.forEach((p) => {
    const row = [
      p.orderNumber,
      `"${p.purchaseDate || ''}"`,
      `"${p.saleDate || ''}"`,
      `"${p.title || ''}"`,
      `"${p.landType || ''}"`,
      `"${p.subdistrict || ''}"`,
      `"${p.district || ''}"`,
      `"${p.province || ''}"`,
      `"${p.primaryDeedNumber || ''}"`,
      `"${p.mapsUrl || ''}"`,
      p.rai,
      p.ngan,
      p.sqWah,
      p.totalRai,
      p.totalSqWah,
      p.pricePerRai,
      p.pricePerSqWah,
      p.purchasePrice,
      p.taxAndFees,
      p.surveyCost,
      p.otherExpenses,
      p.totalCost,
      p.targetSalePrice,
      p.soldPrice,
      p.commissionFee,
      p.netReceived,
      `"${p.status}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ];
    lines.push(row.join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', url);
  dlAnchor.setAttribute('download', `land_portfolio_${new Date().toISOString().slice(0, 10)}.csv`);
  dlAnchor.click();
};

export const calculateKPIs = (plots: LandPlot[]): KPIStats => {
  let holdingPlots = 0;
  let soldPlots = 0;
  let consignmentPlots = 0;

  let totalAreaSqWah = 0;
  let holdingAreaSqWah = 0;

  let totalPurchaseCost = 0;
  let totalAcquisitionCost = 0;
  let totalTargetSalePrice = 0;

  let totalRealizedSales = 0;
  let totalNetReceived = 0;
  let totalRealizedProfit = 0;

  const provinces = new Set<string>();

  plots.forEach((p) => {
    if (p.province) provinces.add(p.province.trim());

    const sqw = Number(p.totalSqWah) || 0;
    const cost = Number(p.totalCost) || 0;
    const purchase = Number(p.purchasePrice) || 0;
    const targetSale = Number(p.targetSalePrice) || 0;
    const sold = Number(p.soldPrice) || 0;
    const net = Number(p.netReceived) || 0;

    totalAreaSqWah += sqw;
    totalPurchaseCost += purchase;
    totalAcquisitionCost += cost;

    if (p.status === 'sold') {
      soldPlots++;
      totalRealizedSales += sold;
      totalNetReceived += net;
      totalRealizedProfit += (net > 0 ? net : sold) - cost;
    } else {
      holdingAreaSqWah += sqw;
      if (p.status === 'consignment') {
        consignmentPlots++;
      } else {
        holdingPlots++;
      }
      totalTargetSalePrice += targetSale > 0 ? targetSale : cost * 1.3; // Default 30% markup if not set
    }
  });

  // Calculate projected gross profit on active holdings
  const holdingAcquisitionCost = plots
    .filter((p) => p.status !== 'sold')
    .reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

  const projectedGrossProfit = totalTargetSalePrice - holdingAcquisitionCost;
  const projectedROI = holdingAcquisitionCost > 0 ? (projectedGrossProfit / holdingAcquisitionCost) * 100 : 0;

  return {
    totalPlots: plots.length,
    holdingPlots,
    soldPlots,
    consignmentPlots,

    totalAreaSqWah,
    totalAreaRai: Number((totalAreaSqWah / 400).toFixed(4)),
    holdingAreaSqWah,
    holdingAreaRai: Number((holdingAreaSqWah / 400).toFixed(4)),

    totalPurchaseCost,
    totalAcquisitionCost,
    totalTargetSalePrice,
    projectedGrossProfit,
    projectedROI,

    totalRealizedSales,
    totalNetReceived,
    totalRealizedProfit,

    provincesCount: provinces.size,
  };
};

/**
 * Format Thai land area helper: e.g. 5 ไร่ 0 งาน 54 ตร.ว.
 */
export const formatThaiArea = (rai: number, ngan: number, sqWah: number): string => {
  const parts = [];
  if (rai > 0) parts.push(`${rai} ไร่`);
  if (ngan > 0) parts.push(`${ngan} งาน`);
  if (sqWah > 0 || parts.length === 0) parts.push(`${sqWah} ตร.ว.`);
  return parts.join(' ');
};

export const formatCurrency = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '0 ฿';
  return `${Number(val).toLocaleString('th-TH')} ฿`;
};
