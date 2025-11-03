import React, { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { InfiniteData } from '@tanstack/query-core/src/types';
import s from './index.module.less';
import Drawer from '@/components/library/Drawer';
import SegmentedControl from '@/components/library/SegmentedControl';
import Button from '@/components/library/Button';
import NotificationsDrawerItem, {
  Notification,
} from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer/NotificationsDrawerItem';
import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { AsyncResource, isFailed, isSuccess } from '@/utils/asyncResource';
import Spinner from '@/components/library/Spinner';
import { NotificationListResponse } from '@/apis';
import { useUsers } from '@/utils/api/auth';
import Alert from '@/components/library/Alert';

interface Props {
  isVisible: boolean;
  onChangeVisibility: (isShown: boolean) => void;
  data: AsyncResource<InfiniteData<NotificationListResponse>>;
  tab: 'ALL' | 'UNREAD';
  setTab: (tab: 'ALL' | 'UNREAD') => void;
  refetch: () => void;
  fetchNextPage?: () => void;
  hasNext?: boolean;
  invalidateAll: () => Promise<void>;
  setHasUnreadNotifications: (value: boolean) => void;
}

export default function NotificationsDrawer(props: Props) {
  const { ref, inView } = useInView();
  const {
    isVisible,
    onChangeVisibility,
    data,
    tab,
    setTab,
    refetch,
    hasNext,
    fetchNextPage,
    invalidateAll,
    setHasUnreadNotifications,
  } = props;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const api = useApi();
  const handleReadAll = () => {
    markAsReadMutation.mutate({});
  };
  const { users, isLoading } = useUsers({
    includeRootUsers: true,
  });
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const markAsRead = () => {
    refetch();
  };

  const getUnreadNotifications = (notifications: Notification[]) => {
    return notifications.filter(
      (x) => !(x.consoleNotificationStatuses ?? []).some(({ status }) => status === 'READ'),
    );
  };

  useEffect(() => {
    setNotifications([]);
    refetch();
    setIsNotificationsLoading(true);
  }, [tab, refetch]);

  useEffect(() => {
    if (isSuccess(data)) {
      const allPages = data.value.pages ?? [];
      const responseNotifications: Notification[] =
        allPages.length > 0 ? allPages.flatMap((page) => page.items) : [];
      setNotifications(responseNotifications);
      setHasUnreadNotifications(getUnreadNotifications(responseNotifications).length > 0);
      setIsNotificationsLoading(false);
    }
  }, [data, setHasUnreadNotifications]);

  useEffect(() => {
    if (inView && fetchNextPage && hasNext && isSuccess(data)) {
      setIsNotificationsLoading(true);
      fetchNextPage();
    }
  }, [inView, data, hasNext, fetchNextPage]);

  const markAsReadMutation = useMutation<unknown, unknown, { notificationId?: string }>(
    async (variables) => {
      const { notificationId } = variables;
      if (notificationId) {
        await api.postNotificationsReadNotificationId({
          notificationId,
        });
      } else {
        await api.postNotificationsMarkAllRead();
      }
    },
    {
      onSuccess: async (data, variables) => {
        const { notificationId } = variables;
        if (!notificationId) {
          message.success('All notifications marked as read successfully');
        }
        await invalidateAll();
        markAsRead();
      },
    },
  );

  async function changeTab(newTab) {
    await invalidateAll();
    setTab(newTab);
  }

  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title={'Notifications'}
      portaled={false}
      position="LEFT"
      drawerMaxWidth="480px"
      noPadding={true}
    >
      <div className={s.root}>
        <div className={s.header}>
          <SegmentedControl
            size="SMALL"
            active={tab}
            onChange={changeTab}
            items={[
              { label: 'All', value: 'ALL' },
              { label: 'Unread', value: 'UNREAD' },
            ]}
          />
          {getUnreadNotifications(notifications).length > 0 && (
            <Button type="TEXT" onClick={handleReadAll} size="SMALL">
              {'Mark all as read'}
            </Button>
          )}
        </div>
        <div className={s.scrollContainer}>
          <div className={s.items}>
            {notifications.length === 0 && !isNotificationsLoading && (
              <div className={s.empty}>
                {tab === 'UNREAD'
                  ? `You don't have any unread notifications`
                  : `You don't have any notifications`}
              </div>
            )}
            {!isLoading &&
              notifications.map((notification, i) => {
                if (notifications.length === i + 1) {
                  return (
                    <NotificationsDrawerItem
                      key={notification.id}
                      notification={notification}
                      markAsReadMutation={markAsReadMutation}
                      innerRef={ref}
                      users={users}
                    />
                  );
                }
                return (
                  <NotificationsDrawerItem
                    key={notification.id}
                    notification={notification}
                    markAsReadMutation={markAsReadMutation}
                    users={users}
                  />
                );
              })}
            {isFailed(data) ? (
              <Alert type={'ERROR'}>Unable to retrieve notifications. {data.message}</Alert>
            ) : (
              <>{(isNotificationsLoading || isLoading) && <Spinner />}</>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
