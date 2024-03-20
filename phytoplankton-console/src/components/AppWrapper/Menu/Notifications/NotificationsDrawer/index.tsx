import React, { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import Drawer from '@/components/library/Drawer';
import SegmentedControl from '@/components/library/SegmentedControl';
import Button from '@/components/library/Button';
import NotificationsDrawerItem, {
  Notification,
} from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer/NotificationsDrawerItem';
import { useApi } from '@/api';
import { NOTIFICATIONS } from '@/utils/queries/keys';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { useCurrentUser } from '@/utils/user-utils';
import { AsyncResource, isLoading, isSuccess } from '@/utils/asyncResource';
import Spinner from '@/components/library/Spinner';
import { ConsoleNotificationStatusStatusEnum } from '@/apis';
import { CursorPaginatedData } from '@/utils/queries/hooks';

interface Props {
  isVisible: boolean;
  onChangeVisibility: (isShown: boolean) => void;
  data: AsyncResource<unknown>;
  tab: 'ALL' | 'UNREAD';
  setTab: (tab: 'ALL' | 'UNREAD') => void;
  refetch: () => void;
  fetchNextPage?: () => void;
  hasNext?: boolean;
}

export default function NotificationsDrawer(props: Props) {
  const { ref, inView } = useInView();
  const { isVisible, onChangeVisibility, data, tab, setTab, refetch, hasNext, fetchNextPage } =
    props;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const api = useApi();
  const handleReadAll = () => {
    markAsReadMutation.mutate({});
  };

  const changeNotificationStatusToRead = (notificationId?: string) => {
    return notifications.map((notification) => {
      if (!notificationId || notification.id === notificationId) {
        return {
          ...notification,
          consoleNotificationStatuses: notification.consoleNotificationStatuses?.map((status) => {
            if (status.recieverUserId === currentUser?.id) {
              return {
                ...status,
                status: 'READ' as ConsoleNotificationStatusStatusEnum,
              };
            }
            return status;
          }),
        };
      }
      return notification;
    });
  };

  const markAsRead = (notificationId?: string) => {
    const newNotifications: Notification[] = changeNotificationStatusToRead(notificationId);
    setNotifications(
      tab === 'UNREAD' ? getUnreadNotifications(newNotifications) : newNotifications,
    );
  };

  const getUnreadNotifications = (notifications: Notification[]) => {
    return notifications.filter(
      (x) => !(x.consoleNotificationStatuses ?? []).some(({ status }) => status === 'READ'),
    );
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries(NOTIFICATIONS('ALL'));
    queryClient.invalidateQueries(NOTIFICATIONS('UNREAD'));
    queryClient.setQueryData(
      NOTIFICATIONS(tab),
      (data?: {
        pages: CursorPaginatedData<Notification>[];
        pageParams: (string | undefined)[];
      }) => {
        return {
          pages: data?.pages.slice(0, 1) ?? [],
          pageParams: data?.pageParams.slice(0, 1) ?? [],
        };
      },
    );
  };

  useEffect(() => {
    setNotifications([]);
    refetch();
  }, [tab, refetch]);

  useEffect(() => {
    if (isSuccess(data)) {
      const allPages = (data.value as any).pages ?? [];
      const responseNotifications: Notification[] =
        allPages.length > 0 ? allPages.flatMap((page) => page.items) : [];
      setNotifications(responseNotifications);
    }
  }, [data]);

  useEffect(() => {
    if (inView && fetchNextPage && hasNext && isSuccess(data)) {
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
      onSuccess: (data, variables) => {
        const { notificationId } = variables;
        if (!notificationId) {
          message.success('All notifications marked as read');
        }
        markAsRead(notificationId);
      },
    },
  );

  function changeTab(newTab) {
    invalidateAll();
    setTab(newTab);
  }
  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title={'Notifications'}
      portaled={false}
      position="LEFT"
      isClickAwayEnabled={true}
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
            {notifications.length === 0 && !isLoading(data) && (
              <div className={s.empty}>
                {tab === 'UNREAD'
                  ? `You don't have any unread notifications`
                  : `You don't have any notifications`}
              </div>
            )}
            {notifications.map((notification, i) => {
              if (notifications.length === i + 1)
                return (
                  <NotificationsDrawerItem
                    key={notification.id}
                    notification={notification}
                    markAsReadMutation={markAsReadMutation}
                    innerRef={ref}
                  />
                );
              return (
                <NotificationsDrawerItem
                  key={notification.id}
                  notification={notification}
                  markAsReadMutation={markAsReadMutation}
                />
              );
            })}
            {isLoading(data) && <Spinner />}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
