import { UserRole, isSuperAdmin } from './user-utils';
import { Account } from '@/apis';

export const getAccountUserName = (account: Account | undefined, defaultStr?: string): string => {
  if (account == null && defaultStr != null) {
    return defaultStr;
  }
  return (account?.name || account?.email || account?.id) + (account?.blocked ? ' (Deleted)' : '');
};

export const getNonSuperAdminUserName = (account?: Account | null): string => {
  if (!account || isSuperAdmin(account) || account.role === UserRole.WHITELABEL_ROOT) {
    return 'System';
  }
  return getAccountUserName(account);
};
