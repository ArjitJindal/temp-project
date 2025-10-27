import { useMemo } from 'react';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { UserRole, isAbove, isSystemUser } from '@/utils/user-utils';
import { useUsers } from '@/utils/api/auth';
import { AsyncResource, success, loading } from '@/utils/asyncResource';

export function useIsInviteDisabled(): AsyncResource<boolean> {
  const settings = useSettings();
  const maxSeats = settings?.limits?.seats ?? 0;
  const { users, isLoading } = useUsers();
  const isInviteDisabled = useMemo((): AsyncResource<boolean> => {
    if (!maxSeats) {
      return success(true);
    }
    if (isLoading) {
      return loading();
    }
    const usedSeats = Object.values(users).filter(
      (user) => !isAbove(user, UserRole.ADMIN) && !user.blocked && !isSystemUser(user.id),
    ).length;
    if (usedSeats == null) {
      return success(true);
    }
    return success(usedSeats >= maxSeats);
  }, [maxSeats, users, isLoading]);

  return isInviteDisabled;
}
