import { LandPlot, PortfolioSettings, KPIStats } from '../types/land';
import { INITIAL_LAND_PLOTS, DEFAULT_SETTINGS } from '../data/defaultLandData';
import { 
  savePlotsToIndexedDB, 
  loadPlotsFromIndexedDB, 
  saveSettingsToIndexedDB, 
  loadSettingsFromIndexedDB 
} from './dbStorage';

export { savePlotsToIndexedDB, loadPlotsFromIndexedDB, saveSettingsToIndexedDB, loadSettingsFromIndexedDB };

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
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p: LandPlot) => {
        if (!p.latitude || !p.longitude) {
          const match = INITIAL_LAND_PLOTS.find((d) => d.id === p.id || d.orderNumber === p.orderNumber);
          if (match?.latitude && match?.longitude) {
            return { ...p, latitude: match.latitude, longitude: match.longitude };
          }
        }
        return p;
      });
    }
    return INITIAL_LAND_PLOTS;
  } catch (e) {
    console.error('Failed to load plots from local storage:', e);
    return INITIAL_LAND_PLOTS;
  }
};

export const savePlotsToStorage = (plots: LandPlot[]) => {
  // 1. Immediately persist full plots with all deed images into IndexedDB (no quota limit)
  savePlotsToIndexedDB(plots).catch((err) => {
    console.warn('Background IndexedDB save encountered an issue:', err);
  });

  // 2. Synchronize with localStorage
  try {
    localStorage.setItem(PLOTS_STORAGE_KEY, JSON.stringify(plots));
  } catch (e: any) {
    console.warn('LocalStorage 5MB quota exceeded, storing sanitized image metadata in localStorage (full images are safely retained in IndexedDB):', e);
    try {
      const sanitized = plots.map((p) => ({
        ...p,
        images: p.images?.map((img) => ({
          ...img,
          url: img.url && img.url.length > 500 && img.url.startsWith('data:')
            ? `[image_ref_${img.id}]`
            : img.url,
        })),
      }));
      localStorage.setItem(PLOTS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (inner) {
      try {
        sessionStorage.setItem(PLOTS_STORAGE_KEY, JSON.stringify(plots));
      } catch (sess) {}
    }
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
  saveSettingsToIndexedDB(settings).catch(() => {});
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

export const resetDataToDefault = (): { plots: LandPlot[]; settings: PortfolioSettings } => {
  savePlotsToIndexedDB(INITIAL_LAND_PLOTS).catch(() => {});
  saveSettingsToIndexedDB(DEFAULT_SETTINGS).catch(() => {});
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
 * Format Thai land area helper: accepts either (rai, ngan, sqWah) or single totalSqWah
 * e.g. 5 ไร่ 0 งาน 54 ตร.ว.
 */
export const formatThaiArea = (
  raiOrTotalSqWah: number,
  ngan?: number,
  sqWah?: number
): string => {
  if (ngan === undefined && sqWah === undefined) {
    const total = Number(raiOrTotalSqWah) || 0;
    const r = Math.floor(total / 400);
    const rem = total % 400;
    const ng = Math.floor(rem / 100);
    const sw = Math.round((rem % 100) * 10) / 10;
    const parts = [];
    if (r > 0) parts.push(`${r} ไร่`);
    if (ng > 0) parts.push(`${ng} งาน`);
    if (sw > 0 || parts.length === 0) parts.push(`${sw} ตร.ว.`);
    return parts.join(' ');
  }
  const r = Number(raiOrTotalSqWah) || 0;
  const ng = Number(ngan) || 0;
  const sw = Number(sqWah) || 0;
  const parts = [];
  if (r > 0) parts.push(`${r} ไร่`);
  if (ng > 0) parts.push(`${ng} งาน`);
  if (sw > 0 || parts.length === 0) parts.push(`${sw} ตร.ว.`);
  return parts.join(' ');
};

export const formatCurrency = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '0 ฿';
  return `${Number(val).toLocaleString('th-TH')} ฿`;
};

export interface HoldingPeriodInfo {
  purchaseDateStr: string;
  parsedDate: Date | null;
  isValid: boolean;
  monthsHeld: number;
  yearsHeld: number;
  formattedDuration: string;
  isExceeded12Mo: boolean;
  isExceeded24Mo: boolean;
  isExceeded36Mo: boolean;
  statusCategory: 'recent' | 'moderate' | 'warning' | 'critical';
}

/**
 * Robust date parser supporting Thai Buddhist Era (พ.ศ.) and Common Era (ค.ศ.)
 * e.g. "23/3/2569", "18/2/2568", "24/6/2557", "30/10/2555", "29-02-2555", "2024-03-25"
 */
export const parsePlotDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (clean === '' || clean === '-' || clean === 'N/A') return null;

  // Split by / or - or .
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // If format was YYYY-MM-DD
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      // If Buddhist Era year (e.g. 2555, 2568, 2569) convert to Gregorian
      if (year > 2400) {
        year -= 543;
      }
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }

  // Fallback to standard Date
  const direct = new Date(clean);
  if (!isNaN(direct.getTime())) {
    if (direct.getFullYear() > 2400) {
      direct.setFullYear(direct.getFullYear() - 543);
    }
    return direct;
  }

  return null;
};

/**
 * Calculate elapsed holding period for a land plot relative to current date
 */
export const calculatePlotHoldingInfo = (
  purchaseDateStr: string | undefined | null,
  referenceDate: Date = new Date()
): HoldingPeriodInfo => {
  const parsed = parsePlotDate(purchaseDateStr);
  if (!parsed) {
    return {
      purchaseDateStr: purchaseDateStr || '-',
      parsedDate: null,
      isValid: false,
      monthsHeld: 0,
      yearsHeld: 0,
      formattedDuration: 'ไม่ระบุวันที่ซื้อ',
      isExceeded12Mo: false,
      isExceeded24Mo: false,
      isExceeded36Mo: false,
      statusCategory: 'recent',
    };
  }

  const diffMs = referenceDate.getTime() - parsed.getTime();
  if (diffMs < 0) {
    return {
      purchaseDateStr: purchaseDateStr || '',
      parsedDate: parsed,
      isValid: true,
      monthsHeld: 0,
      yearsHeld: 0,
      formattedDuration: 'เพิ่งซื้อ / บันทึกล่วงหน้า',
      isExceeded12Mo: false,
      isExceeded24Mo: false,
      isExceeded36Mo: false,
      statusCategory: 'recent',
    };
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const monthsHeld = Math.max(0, Math.floor(diffDays / 30.4375));
  const years = Math.floor(monthsHeld / 12);
  const remainingMonths = monthsHeld % 12;

  let formattedDuration = '';
  if (years > 0 && remainingMonths > 0) {
    formattedDuration = `${years} ปี ${remainingMonths} เดือน`;
  } else if (years > 0) {
    formattedDuration = `${years} ปี`;
  } else {
    formattedDuration = `${monthsHeld} เดือน`;
  }

  const isExceeded12Mo = monthsHeld >= 12;
  const isExceeded24Mo = monthsHeld >= 24;
  const isExceeded36Mo = monthsHeld >= 36;

  let statusCategory: 'recent' | 'moderate' | 'warning' | 'critical' = 'recent';
  if (isExceeded24Mo) {
    statusCategory = 'critical';
  } else if (isExceeded12Mo) {
    statusCategory = 'warning';
  } else if (monthsHeld >= 6) {
    statusCategory = 'moderate';
  }

  return {
    purchaseDateStr: purchaseDateStr || '',
    parsedDate: parsed,
    isValid: true,
    monthsHeld,
    yearsHeld: Number((monthsHeld / 12).toFixed(1)),
    formattedDuration,
    isExceeded12Mo,
    isExceeded24Mo,
    isExceeded36Mo,
    statusCategory,
  };
};
