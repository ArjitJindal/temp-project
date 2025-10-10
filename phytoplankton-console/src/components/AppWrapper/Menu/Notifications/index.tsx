import cn from 'clsx';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NotificationsDrawer from './NotificationsDrawer';
import s from './index.module.less';
import { useApi } from '@/api';
import { useInfiniteQuery } from '@/utils/queries/hooks';
import { NOTIFICATIONS } from '@/utils/queries/keys';
import { NotificationListResponse } from '@/apis';

interface Props {
  isNotificationsDrawerVisible: boolean;
  setIsNotificationsDrawerVisible: (value: boolean) => void;
  setHasUnreadNotifications: (value: boolean) => void;
}

const NOTIFICATION_REFETCH_INTERVAL = 60;

export const Notifications = (props: Props) => {
  const {
    isNotificationsDrawerVisible,
    setIsNotificationsDrawerVisible,
    setHasUnreadNotifications,
  } = props;
  const [tab, setTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const api = useApi();
  const queryClient = useQueryClient();
  const queryResult = useInfiniteQuery<NotificationListResponse>(
    NOTIFICATIONS(tab),
    async ({ pageParam = '' }): Promise<NotificationListResponse> => {
      return await api.getNotifications({ start: pageParam, notificationStatus: tab });
    },
    {
      getNextPageParam(lastPage) {
        return lastPage?.hasNext ? lastPage?.next : null;
      },
      refetchInterval: NOTIFICATION_REFETCH_INTERVAL * 1000,
    },
  );

  const invalidateAll = async () => {
    await queryClient.invalidateQueries(NOTIFICATIONS('ALL'));
    await queryClient.invalidateQueries(NOTIFICATIONS('UNREAD'));
  };
  useEffect(() => {
    if (isNotificationsDrawerVisible) {
      queryResult.refetch();
    }
  }, [isNotificationsDrawerVisible, queryResult.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn(s.drawerContainer, isNotificationsDrawerVisible && s.isVisible)}>
      <NotificationsDrawer
        data={queryResult.data}
        isVisible={isNotificationsDrawerVisible}
        onChangeVisibility={setIsNotificationsDrawerVisible}
        tab={tab}
        setTab={setTab}
        refetch={queryResult.refetch}
        fetchNextPage={queryResult.fetchNextPage}
        hasNext={queryResult.hasNext}
        invalidateAll={invalidateAll}
        setHasUnreadNotifications={setHasUnreadNotifications}
      />
    </div>
  );
};
