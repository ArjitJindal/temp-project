import { useApi } from '@/api';
import { useInfiniteQuery } from '@/utils/queries/hooks';
import { NOTIFICATIONS } from '@/utils/queries/keys';
import { NotificationListResponse } from '@/apis';

export function useNotificationsInfinite(
  tab: 'ALL' | 'UNREAD',
  options?: { refetchIntervalSeconds?: number },
) {
  const api = useApi();
  return useInfiniteQuery<NotificationListResponse>(
    NOTIFICATIONS(tab),
    async ({ pageParam = '' }) =>
      api.getNotifications({ start: pageParam, notificationStatus: tab }),
    {
      getNextPageParam(lastPage) {
        return lastPage?.hasNext ? lastPage?.next : null;
      },
      refetchInterval: (options?.refetchIntervalSeconds ?? 60) * 1000,
    },
  );
}
