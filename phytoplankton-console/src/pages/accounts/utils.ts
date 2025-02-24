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
