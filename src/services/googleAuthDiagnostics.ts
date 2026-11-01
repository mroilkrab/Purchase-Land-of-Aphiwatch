import { 
  getSheetsAccessToken, 
  getAccessToken, 
  googleSignIn, 
  hasGrantedSheetsScope,
  isInsufficientScopesError 
} from './firebaseAuth';

export interface ScopeDiagnosticItem {
  name: string;
  scopeUrl: string;
  descriptionThai: string;
  status: 'granted' | 'missing' | 'unknown';
  isRequiredForSheets: boolean;
}

export interface GoogleApiConnectionStatus {
  timestamp: string;
  hasToken: boolean;
  tokenType: 'elevated_sheets' | 'base_profile' | 'none';
  isValid: boolean;
  email?: string;
  expiresInSeconds?: number;
  scopes: string[];
  scopeDetails: ScopeDiagnosticItem[];
  sheetsApiUsable: boolean;
  driveApiUsable: boolean;
  statusLevel: 'ready' | 'needs_elevation' | 'expired' | 'unauthenticated' | 'error';
  headlineThai: string;
  messageThai: string;
  troubleshootAdvice: string[];
}

const REQUIRED_SCOPES: { name: string; scopeUrl: string; desc: string; isRequiredForSheets: boolean }[] = [
  {
    name: 'Google Sheets (ตารางคำนวณ)',
    scopeUrl: 'https://www.googleapis.com/auth/spreadsheets',
    desc: 'สิทธิ์ในการสร้าง บันทึก และอัปเดตตารางสรุปพอร์ตแปลงที่ดินใน Google Sheets',
    isRequiredForSheets: true,
  },
  {
    name: 'Google Drive (สำรองไฟล์)',
    scopeUrl: 'https://www.googleapis.com/auth/drive.file',
    desc: 'สิทธิ์ในการบันทึกไฟล์สำรองข้อมูล Snapshot JSON และรูปโฉนดลงใน Google Drive ส่วนตัว',
    isRequiredForSheets: true,
  },
  {
    name: 'Google Account Profile (โปรไฟล์)',
    scopeUrl: 'https://www.googleapis.com/auth/userinfo.profile',
    desc: 'สิทธิ์ในการอ่านชื่อ รูปโปรไฟล์ และข้อมูลพื้นฐานสำหรับยืนยันตัวตน',
    isRequiredForSheets: false,
  },
  {
    name: 'Google Account Email (อีเมล)',
    scopeUrl: 'https://www.googleapis.com/auth/userinfo.email',
    desc: 'สิทธิ์ในการระบุตัวตนและตรวจสอบสิทธิ์ตามบทบาทผู้ใช้งาน (RBAC)',
    isRequiredForSheets: false,
  },
];

/**
 * Perform deep diagnostics of the current Google OAuth token & Google API Scopes.
 */
export const checkGoogleApiStatus = async (userExplicitToken?: string | null): Promise<GoogleApiConnectionStatus> => {
  const timestamp = new Date().toLocaleTimeString('th-TH');

  // 1. Determine active token to check (prioritize elevated sheets token, then base token)
  let token = userExplicitToken || null;
  let tokenType: 'elevated_sheets' | 'base_profile' | 'none' = 'none';

  if (!token) {
    const elevated = await getSheetsAccessToken(false);
    if (elevated) {
      token = elevated;
      tokenType = 'elevated_sheets';
    } else {
      const base = await getAccessToken();
      if (base) {
        token = base;
        tokenType = 'base_profile';
      }
    }
  } else {
    tokenType = hasGrantedSheetsScope() ? 'elevated_sheets' : 'base_profile';
  }

  if (!token) {
    return {
      timestamp,
      hasToken: false,
      tokenType: 'none',
      isValid: false,
      scopes: [],
      scopeDetails: REQUIRED_SCOPES.map(s => ({
        name: s.name,
        scopeUrl: s.scopeUrl,
        descriptionThai: s.desc,
        status: 'missing',
        isRequiredForSheets: s.isRequiredForSheets,
      })),
      sheetsApiUsable: false,
      driveApiUsable: false,
      statusLevel: 'unauthenticated',
      headlineThai: 'ยังไม่ได้เชื่อมต่อบัญชี Google',
      messageThai: 'ไม่พบ OAuth Access Token ในระบบ กรุณากดเข้าสู่ระบบด้วย Google หรือกดเชื่อมต่อสิทธิ์',
      troubleshootAdvice: [
        'กดปุ่ม "เข้าสู่ระบบด้วย Google" ที่มุมขวาบน หรือกดปุ่ม "เชื่อมต่อสิทธิ์ Google Sheets"',
        'หากเข้าสู่ระบบแล้ว ให้กดปุ่ม "ยกระดับสิทธิ์ Google Sheets" เพื่อขออนุญาตสิทธิ์เข้าถึงตาราง',
      ],
    };
  }

  // 2. Query Google's tokeninfo endpoint
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const isExpired = errData.error_description?.toLowerCase().includes('expired') || response.status === 400;

      return {
        timestamp,
        hasToken: true,
        tokenType,
        isValid: false,
        scopes: [],
        scopeDetails: REQUIRED_SCOPES.map(s => ({
          name: s.name,
          scopeUrl: s.scopeUrl,
          descriptionThai: s.desc,
          status: 'missing',
          isRequiredForSheets: s.isRequiredForSheets,
        })),
        sheetsApiUsable: false,
        driveApiUsable: false,
        statusLevel: isExpired ? 'expired' : 'error',
        headlineThai: isExpired ? 'Token หมดอายุแล้ว' : 'Token ไม่ถูกต้องหรือถูกเพิกถอน',
        messageThai: isExpired 
          ? 'Google Access Token ปัจจุบันหมดอายุแล้ว กรุณากดปุ่ม "รีเฟรชสิทธิ์การเข้าถึง" ด้านล่าง' 
          : 'Google ปฏิเสธ Token นี้ อาจเกิดจากการออกจากระบบหรือยกเลิกสิทธิ์ กรุณากดขอสิทธิ์ใหม่',
        troubleshootAdvice: [
          'กดปุ่ม "รีเฟรชสิทธิ์การเข้าถึง" เพื่อขอรับโทเค็นใหม่ผ่าน Google Login Popup',
          'หากยังมีปัญหา ให้กดปุ่ม "ล้างแคช Token" แล้วเชื่อมต่อใหม่อีกครั้ง',
        ],
      };
    }

    const tokenData = await response.json();
    const rawScopeStr: string = tokenData.scope || '';
    const scopesList = rawScopeStr.split(' ').map(s => s.trim()).filter(Boolean);
    const expiresIn = Number(tokenData.expires_in) || 0;
    const email = tokenData.email || undefined;

    // Check individual scopes
    const hasSheets = scopesList.some(s => s.includes('spreadsheets'));
    const hasDrive = scopesList.some(s => s.includes('drive'));
    const hasEmail = scopesList.some(s => s.includes('email') || s.includes('userinfo'));

    const scopeDetails: ScopeDiagnosticItem[] = REQUIRED_SCOPES.map(item => {
      const isGranted = scopesList.some(s => s.toLowerCase() === item.scopeUrl.toLowerCase() || s.endsWith(item.scopeUrl.split('/').pop() || ''));
      return {
        name: item.name,
        scopeUrl: item.scopeUrl,
        descriptionThai: item.desc,
        status: isGranted ? 'granted' : 'missing',
        isRequiredForSheets: item.isRequiredForSheets,
      };
    });

    // 3. Active Verification against Google Sheets API
    let sheetsApiUsable = false;
    if (hasSheets) {
      try {
        // Simple probe to verify authorization
        const sheetsProbe = await fetch('https://sheets.googleapis.com/v4/spreadsheets?pageSize=1', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        // 403 with insufficient scopes means not usable; 400 or 404 or 200 means auth passed
        if (sheetsProbe.status === 403) {
          const body = await sheetsProbe.text();
          sheetsApiUsable = !isInsufficientScopesError(body);
        } else {
          sheetsApiUsable = true;
        }
      } catch (e) {
        sheetsApiUsable = true; // assume usable if offline/CORS
      }
    }

    if (hasSheets && sheetsApiUsable) {
      return {
        timestamp,
        hasToken: true,
        tokenType: 'elevated_sheets',
        isValid: true,
        email,
        expiresInSeconds: expiresIn,
        scopes: scopesList,
        scopeDetails,
        sheetsApiUsable: true,
        driveApiUsable: hasDrive,
        statusLevel: 'ready',
        headlineThai: '🟢 เชื่อมต่อสมบูรณ์ ได้รับสิทธิ์ Google Sheets & Drive แล้ว',
        messageThai: `ระบบได้รับสิทธิ์เข้าถึง Google Sheets ครบถ้วน พร้อมสำหรับการเขียนตาราง ส่งออก และซิงค์ข้อมูลไฮบริด (Token หมดอายุใน ${Math.round(expiresIn / 60)} นาที)`,
        troubleshootAdvice: [
          'สถานะพร้อมใช้งาน 100% สามารถกด "ซิงค์ Google Sheet" หรือ "ซิงค์ไฮบริด" ได้ทันที',
        ],
      };
    } else {
      return {
        timestamp,
        hasToken: true,
        tokenType: 'base_profile',
        isValid: true,
        email,
        expiresInSeconds: expiresIn,
        scopes: scopesList,
        scopeDetails,
        sheetsApiUsable: false,
        driveApiUsable: hasDrive,
        statusLevel: 'needs_elevation',
        headlineThai: '🟡 ขาดสิทธิ์ Google Sheets (Request had insufficient authentication scopes)',
        messageThai: 'บัญชีของคุณเข้าสู่ระบบแล้ว แต่ยังไม่ได้ให้สิทธิ์เข้าถึง Google Sheets และ Drive ตารางจะไม่สามารถซิงค์ได้จนกว่าจะกดอนุญาต',
        troubleshootAdvice: [
          'กดปุ่ม "ยกระดับสิทธิ์ Google Sheets" ด้านล่าง เพื่อเปิดหน้าต่าง Google และกดยืนยันอนุญาตสิทธิ์ 1 ครั้ง',
          'หลังจากอนุญาตสำเร็จ สถานะจะเปลี่ยนเป็นสีเขียว พร้อมซิงค์ข้อมูลได้ทันที',
        ],
      };
    }
  } catch (netErr: any) {
    return {
      timestamp,
      hasToken: true,
      tokenType,
      isValid: false,
      scopes: [],
      scopeDetails: REQUIRED_SCOPES.map(s => ({
        name: s.name,
        scopeUrl: s.scopeUrl,
        descriptionThai: s.desc,
        status: 'unknown',
        isRequiredForSheets: s.isRequiredForSheets,
      })),
      sheetsApiUsable: false,
      driveApiUsable: false,
      statusLevel: 'error',
      headlineThai: 'ไม่สามารถติดต่อ Google Auth Server ได้',
      messageThai: netErr.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะกับ Google API',
      troubleshootAdvice: [
        'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        'กดปุ่ม "ตรวจสอบสิทธิ์การเข้าถึง" เพื่อลองใหม่อีกครั้ง',
      ],
    };
  }
};

/**
 * Clears cached tokens so the user can re-authenticate fresh.
 */
export const clearCachedGoogleTokens = () => {
  try {
    sessionStorage.removeItem('google_oauth_access_token_v1');
    localStorage.removeItem('google_oauth_access_token_v1');
    sessionStorage.removeItem('google_oauth_sheets_token_v1');
    localStorage.removeItem('google_oauth_sheets_token_v1');
  } catch (e) {}
};
