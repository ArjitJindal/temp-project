import cn from 'clsx';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NotificationsDrawer from './NotificationsDrawer';
import s from './index.module.less';
import { useNotificationsInfinite } from '@/hooks/api';

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
  const queryClient = useQueryClient();
  const queryResult = useNotificationsInfinite(tab, {
    refetchIntervalSeconds: NOTIFICATION_REFETCH_INTERVAL,
  });

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications', 'tab-ALL'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications', 'tab-UNREAD'] });
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
