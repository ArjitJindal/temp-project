import { useQueryClient } from '@tanstack/react-query';
import { Updater } from '@tanstack/react-table';
import { useCallback } from 'react';
import { ALERT_ITEM, ALERT_ITEM_COMMENTS } from '../queries/keys';
import { Alert } from '@/apis';

export function isScreeningAlert(alert: Alert | undefined): boolean {
  return (
    alert?.ruleNature === 'SCREENING' &&
    alert.ruleHitMeta?.sanctionsDetails != null &&
    alert.alertId != null
  );
}

export const useUpdateAlertQueryData = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (alertId: string | undefined, updater: Updater<Alert | undefined>) => {
      if (alertId) {
        queryClient.setQueryData<Alert>(ALERT_ITEM(alertId), updater);
      }
    },
    [queryClient],
  );
};

export const useUpdateAlertItemCommentsData = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (alertId: string | undefined, updater: Updater<Alert['comments'] | undefined>) => {
      if (alertId) {
        queryClient.setQueryData<Alert['comments']>(ALERT_ITEM_COMMENTS(alertId), updater);
      }
    },
    [queryClient],
  );
};
