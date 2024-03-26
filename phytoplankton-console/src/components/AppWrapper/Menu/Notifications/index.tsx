import cn from 'clsx';
import { useState } from 'react';
import NotificationsDrawer from './NotificationsDrawer';
import s from './index.module.less';
import { useApi } from '@/api';
import { useInfiniteQuery } from '@/utils/queries/hooks';
import { NOTIFICATIONS } from '@/utils/queries/keys';
import { NotificationListResponse } from '@/apis';

interface Props {
  isNotificationsDrawerVisible: boolean;
  setIsNotificationsDrawerVisible: (value: boolean) => void;
}

const NOTIFICATION_REFETCH_INTERVAL = 60;

export const Notifications = (props: Props) => {
  const { isNotificationsDrawerVisible, setIsNotificationsDrawerVisible } = props;
  const [tab, setTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const api = useApi();

  const queryResult = useInfiniteQuery<NotificationListResponse>(
    NOTIFICATIONS(tab),
    async ({ pageParam = '' }): Promise<NotificationListResponse> => {
      return await api.getNotifications({ start: pageParam, notificationStatus: tab });
    },
    {
      getNextPageParam(lastPage) {
        return lastPage.hasNext ? lastPage.next : null;
      },
      refetchInterval: NOTIFICATION_REFETCH_INTERVAL * 1000,
    },
  );
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
      />
    </div>
  );
};
