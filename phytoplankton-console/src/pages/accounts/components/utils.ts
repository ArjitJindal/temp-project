import { useMemo } from 'react';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { UserRole, isAbove, useUsers } from '@/utils/user-utils';

export const useIsInviteDisabled = () => {
  const settings = useSettings();
  const maxSeats = settings?.limits?.seats ?? 0;
  const [accounts, loading] = useUsers();

  const isInviteDisabled = useMemo(() => {
    if (!maxSeats) {
      return true;
    }
    if (loading) {
      return null;
    }
    const usedSeats = Object.values(accounts).filter(
      (account) => !isAbove(account, UserRole.ADMIN) && !account.blocked,
    ).length;
    if (usedSeats == null) {
      return true;
    }
    return usedSeats >= maxSeats;
  }, [maxSeats, accounts, loading]);

  return isInviteDisabled;
};
