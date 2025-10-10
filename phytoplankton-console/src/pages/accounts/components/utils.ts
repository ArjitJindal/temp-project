import { useMemo } from 'react';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { UserRole, isAbove, isSystemUser, useUsers } from '@/utils/user-utils';
import { AsyncResource, success, loading } from '@/utils/asyncResource';

export function useIsInviteDisabled(): AsyncResource<boolean> {
  const settings = useSettings();
  const maxSeats = settings?.limits?.seats ?? 0;
  const [accounts, isLoading] = useUsers();
  const isInviteDisabled = useMemo((): AsyncResource<boolean> => {
    if (!maxSeats) {
      return success(true);
    }
    if (isLoading) {
      return loading();
    }
    const usedSeats = Object.values(accounts).filter(
      (account) =>
        !isAbove(account, UserRole.ADMIN) && !account.blocked && !isSystemUser(account.id),
    ).length;
    if (usedSeats == null) {
      return success(true);
    }
    return success(usedSeats >= maxSeats);
  }, [maxSeats, accounts, isLoading]);

  return isInviteDisabled;
}
