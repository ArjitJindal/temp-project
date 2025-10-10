import { sanitizeString } from '@flagright/lib/utils';
import { AccountRole } from '@/apis';

const demoRolePrefix = 'demo-';

export const getSantiziedRoleName = (roleName: string | undefined) => {
  if (!roleName) {
    return '';
  }
  return roleName.replaceAll(demoRolePrefix, '');
};

export const getDemoRoleName = (roleName: string) => {
  return demoRolePrefix + roleName;
};

export const determineDemoRoleByName = (roleName: string) => {
  return roleName.includes(demoRolePrefix);
};

export const isDemoRole = (role: AccountRole | undefined, isDemoMode: boolean): boolean => {
  if (role) {
    if (determineDemoRoleByName(role.name)) {
      return true;
    } else {
      return false;
    }
  } else {
    if (isDemoMode) {
      return true;
    } else {
      return false;
    }
  }
};

// Format role name while preserving numbers with adjacent letters and handling special characters
export const formatRoleName = (roleName: string | undefined) => {
  if (!roleName) {
    return '';
  }
  const sanitized = getSantiziedRoleName(roleName);

  // Remove special characters, preserving alphanumeric sequences
  const cleanedName = sanitizeString(sanitized, true);

  // Split at spaces and hyphens, preserving alphanumeric sequences
  return cleanedName
    .split(/[\s-]+/)
    .filter((word) => word.length > 0) // Remove empty segments
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
