import React, { useMemo } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import NotificationMessage from './NotificationMessage';
import Avatar from '@/components/library/Avatar';
import { Notification as NotificationBase } from '@/apis';
import { useUsers } from '@/utils/user-utils';
import { dayjs, TIME_FORMAT_WITHOUT_SECONDS, duration } from '@/utils/dayjs';
import { Mutation } from '@/utils/queries/types';

export type Notification = NotificationBase;

interface Props {
  notification: Notification;
  innerRef?: React.Ref<HTMLDivElement>;
  markAsReadMutation: Mutation<
    unknown,
    unknown,
    {
      notificationId?: string | undefined;
    },
    unknown
  >;
}

export default function NotificationsDrawerItem(props: Props) {
  const { notification, markAsReadMutation, innerRef } = props;
  const isRead = useMemo(() => {
    return notification.consoleNotificationStatuses?.some((x) => x.status === 'READ') ?? false;
  }, [notification.consoleNotificationStatuses]);
  const [users, isLoading] = useUsers({
    includeRootUsers: true,
  });
  function handleReadNotification(notificationId) {
    markAsReadMutation.mutate({ notificationId });
  }
  return (
    <div
      className={cn(s.root, !isRead && s.isUnread)}
      onClick={() => {
        window.open(getNotificationUrl(notification));
        if (notification.consoleNotificationStatuses?.some((x) => x.status === 'SENT')) {
          handleReadNotification(notification.id);
        }
      }}
      ref={innerRef}
    >
      <Avatar size="medium" user={users[notification.triggeredBy]} isLoading={isLoading} />
      <div className={s.content}>
        <div className={s.message} data-cy={'notification-message'}>
          <NotificationMessage notification={notification} />
        </div>
        <div className={s.time}>
          <div className={s.timePart}>
            {dayjs(notification.createdAt).format(TIME_FORMAT_WITHOUT_SECONDS)}
          </div>
          <div className={s.separator}></div>
          <div className={s.timePart}>
            {duration(notification.createdAt - Date.now(), 'milliseconds').humanize(true)}
          </div>
        </div>
      </div>
      <div className={s.unreadIndicator}></div>
    </div>
  );
}

const getNotificationUrl = (notification: Notification) => {
  const { entityId, entityType, metadata } = notification;
  switch (entityType) {
    case 'ALERT': {
      const caseId = metadata?.alert?.caseId;
      return caseId ? `/case-management/case/${caseId}/alerts?expandedAlertId=${entityId}` : '#';
    }
    case 'CASE':
      return `/case-management/case/${entityId}`;
    case 'USER': {
      const userType = metadata?.user?.userType;
      return userType ? `/users/list/${userType.toLowerCase()}/${entityId}/activity` : '#';
    }
    default:
      return '#';
  }
};
