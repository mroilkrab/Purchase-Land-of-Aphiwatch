import { User } from 'firebase/auth';
import { UserRole, AuthorizedUser, AccessControlPolicy, PortfolioSettings } from '../types/land';

export interface RolePermissions {
  canView: boolean;
  canExport: boolean;
  canPrint: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canChangeSettings: boolean;
  canSyncCloud: boolean;
}

export const ROLE_DEFINITIONS: Record<
  UserRole,
  {
    labelThai: string;
    descriptionThai: string;
    colorBadge: string;
    permissions: RolePermissions;
  }
> = {
  owner: {
    labelThai: 'เจ้าของระบบ (Owner)',
    descriptionThai: 'สิทธิ์สูงสุด: ดู, เพิ่ม, แก้ไข, ลบแปลง, สำรองข้อมูล, จัดการสิทธิ์ผู้ใช้งานทั้งหมด',
    colorBadge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    permissions: {
      canView: true,
      canExport: true,
      canPrint: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManageUsers: true,
      canChangeSettings: true,
      canSyncCloud: true,
    },
  },
  editor: {
    labelThai: 'ผู้ร่วมจัดการ / ผู้แก้ไข (Editor)',
    descriptionThai: 'จัดการข้อมูล: เพิ่มแปลง, แก้ไขข้อมูลที่ดิน, อัปโหลดโฉนด/รูปภาพ, บันทึกหมายเหตุ, พิมพ์รายงาน',
    colorBadge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    permissions: {
      canView: true,
      canExport: true,
      canPrint: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManageUsers: false,
      canChangeSettings: false,
      canSyncCloud: true,
    },
  },
  viewer: {
    labelThai: 'ผู้เข้าชม (Viewer)',
    descriptionThai: 'ดูข้อมูลอย่างเดียว: ค้นหา, กรองข้อมูล, ดูแผนที่, ดูภาพโฉนด, พิมพ์รายงาน A4 (ไม่สามารถแก้ไขข้อมูลได้)',
    colorBadge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    permissions: {
      canView: true,
      canExport: true,
      canPrint: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManageUsers: false,
      canChangeSettings: false,
      canSyncCloud: false,
    },
  },
};

/**
 * Determine the active user role based on email and portfolio settings
 */
export const getUserRole = (
  user: User | { email?: string | null } | null,
  settings: PortfolioSettings
): UserRole => {
  // If not logged in, they are in Viewer mode
  if (!user || !user.email) {
    return 'owner'; // Local offline standalone mode has full rights if no auth used
  }

  const normalizedEmail = user.email.toLowerCase().trim();

  // 1. Check primary admin emails list
  const adminEmails = (settings.adminEmails || ['aspowernetwork@gmail.com']).map((e) =>
    e.toLowerCase().trim()
  );
  if (adminEmails.includes(normalizedEmail)) {
    return 'owner';
  }

  // 2. Check authorizedUsers list
  const authorizedUsers = settings.authorizedUsers || [];
  const matchedUser = authorizedUsers.find(
    (u) => u.email.toLowerCase().trim() === normalizedEmail
  );

  if (matchedUser) {
    if (matchedUser.status === 'revoked') {
      return 'viewer';
    }
    return matchedUser.role;
  }

  // 3. Fallback based on Access Policy for logged in team members not explicitly in list
  if (settings.accessPolicy === 'open_team') {
    // Open team policy: Anyone with a company Google account gets Editor access
    return 'editor';
  }

  // Whitelist-only policy: unlisted users are limited to Viewer
  return 'viewer';
};

/**
 * Check if a role has permission for a specific action
 */
export const hasPermission = (
  role: UserRole,
  action: keyof RolePermissions
): boolean => {
  return ROLE_DEFINITIONS[role]?.permissions[action] ?? false;
};

/**
 * Add or update an authorized user in the settings
 */
export const upsertAuthorizedUser = (
  settings: PortfolioSettings,
  userEntry: {
    email: string;
    displayName?: string;
    role: UserRole;
    notes?: string;
  },
  addedByEmail?: string
): PortfolioSettings => {
  const currentList = settings.authorizedUsers || [];
  const normalizedEmail = userEntry.email.toLowerCase().trim();

  const existingIndex = currentList.findIndex(
    (u) => u.email.toLowerCase().trim() === normalizedEmail
  );

  let updatedList: AuthorizedUser[];

  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = {
      ...updatedList[existingIndex],
      role: userEntry.role,
      displayName: userEntry.displayName || updatedList[existingIndex].displayName,
      notes: userEntry.notes !== undefined ? userEntry.notes : updatedList[existingIndex].notes,
      status: 'active',
    };
  } else {
    const newUser: AuthorizedUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: normalizedEmail,
      displayName: userEntry.displayName || normalizedEmail.split('@')[0],
      role: userEntry.role,
      status: 'active',
      addedAt: new Date().toISOString(),
      addedBy: addedByEmail || 'Admin',
      notes: userEntry.notes || '',
    };
    updatedList = [newUser, ...currentList];
  }

  // If role is owner, ensure adminEmails contains it
  let updatedAdmins = settings.adminEmails || [];
  if (userEntry.role === 'owner' && !updatedAdmins.includes(normalizedEmail)) {
    updatedAdmins = [...updatedAdmins, normalizedEmail];
  }

  return {
    ...settings,
    authorizedUsers: updatedList,
    adminEmails: updatedAdmins,
  };
};

/**
 * Revoke or remove an authorized user
 */
export const removeAuthorizedUser = (
  settings: PortfolioSettings,
  userEmail: string
): PortfolioSettings => {
  const normalizedEmail = userEmail.toLowerCase().trim();
  const updatedList = (settings.authorizedUsers || []).filter(
    (u) => u.email.toLowerCase().trim() !== normalizedEmail
  );
  const updatedAdmins = (settings.adminEmails || []).filter(
    (e) => e.toLowerCase().trim() !== normalizedEmail
  );

  return {
    ...settings,
    authorizedUsers: updatedList,
    adminEmails: updatedAdmins.length > 0 ? updatedAdmins : ['aspowernetwork@gmail.com'],
  };
};
