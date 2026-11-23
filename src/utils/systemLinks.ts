import { PortfolioSettings, SystemLinkCategory } from '../types/land';

export const SYSTEM_LINK_CATEGORIES: {
  id: SystemLinkCategory;
  labelThai: string;
  badgeClass: string;
}[] = [
  {
    id: 'app_access',
    labelThai: 'ลิงก์เข้าใช้งานระบบ',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'cloud_sync',
    labelThai: 'คลาวด์ & ฐานข้อมูล',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  {
    id: 'land_agency',
    labelThai: 'หน่วยงานที่ดิน / กรมธนารักษ์',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  {
    id: 'team_resource',
    labelThai: 'เอกสาร / ทรัพยากรทีม',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  {
    id: 'other',
    labelThai: 'ลิงก์อื่นๆ',
    badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600/60',
  },
];

export const getCategoryMeta = (category: SystemLinkCategory) => {
  return (
    SYSTEM_LINK_CATEGORIES.find((c) => c.id === category) ||
    SYSTEM_LINK_CATEGORIES[SYSTEM_LINK_CATEGORIES.length - 1]
  );
};

/**
 * Normalizes and validates an HTTP/HTTPS URL safely.
 * Rejects dangerous protocols such as javascript:, data:, vbscript:, file:.
 */
export const normalizeSystemUrl = (raw: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return '';
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

export const isValidHttpUrl = (raw: string): boolean => {
  if (!raw || !raw.trim()) return false;
  return normalizeSystemUrl(raw) !== '';
};

/**
 * Accepts either a raw Google Spreadsheet ID or a full Google Sheets URL
 * (e.g. https://docs.google.com/spreadsheets/d/1AbC.../edit#gid=0) and extracts the ID.
 */
export const extractGoogleSheetId = (input: string): string => {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Fallback if user pasted URL query id=
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  // Raw ID (strip whitespace/trailing slashes)
  return trimmed.replace(/^\/+|\/+$/g, '');
};

export const buildGoogleSheetUrl = (sheetId?: string): string => {
  const cleaned = extractGoogleSheetId(sheetId || '');
  return cleaned ? `https://docs.google.com/spreadsheets/d/${cleaned}/edit` : '';
};

export const getPrimarySystemUrl = (settings: PortfolioSettings): string => {
  const custom = normalizeSystemUrl(settings.customAppUrl || '');
  if (custom) return custom;

  const shared = normalizeSystemUrl(settings.sharedAppUrl || '');
  if (shared) return shared;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return normalizeSystemUrl(settings.devAppUrl || '');
};

export const copyTextSafely = async (text: string): Promise<boolean> => {
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for iframe clipboard restrictions
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

export const buildShareInviteMessage = (
  settings: PortfolioSettings,
  primaryUrl: string
): string => {
  const title = settings.portfolioTitle || 'ระบบบริหารจัดการพอร์ตที่ดิน';
  const owner = settings.ownerName || 'อภิวัชร์';
  const sheetUrl = buildGoogleSheetUrl(settings.googleSheetId);
  const driveUrl = normalizeSystemUrl(settings.googleDriveFolderUrl || '');

  const lines = [
    `📌 ลิงก์เข้าใช้งาน: ${title}`,
    `👤 เจ้าของพอร์ต: ${owner}`,
    `🌐 เข้าสู่ระบบ (App URL): ${primaryUrl}`,
  ];

  if (sheetUrl) {
    lines.push(`📊 Google Sheets บัญชีข้อมูล: ${sheetUrl}`);
  }
  if (driveUrl) {
    lines.push(`📁 Google Drive เอกสาร/โฉนด: ${driveUrl}`);
  }

  lines.push(`💡 เข้าใช้งานได้ทั้งบนมือถือและคอมพิวเตอร์ (แนะนำเปิดผ่าน Chrome / Safari)`);
  return lines.join('\n');
};
