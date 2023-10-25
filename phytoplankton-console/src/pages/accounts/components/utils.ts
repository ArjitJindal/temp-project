import { useMemo } from 'react';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useUsers } from '@/utils/user-utils';

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

    const existingSeats = Object.values(accounts).length;

    if (existingSeats == null) {
      return true;
    }

    return existingSeats >= maxSeats;
  }, [maxSeats, accounts, loading]);

  return isInviteDisabled;
};
