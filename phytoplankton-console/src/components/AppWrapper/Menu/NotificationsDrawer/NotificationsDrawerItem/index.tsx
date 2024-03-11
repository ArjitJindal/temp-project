import React, { useMemo } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import NotificationMessage from './NotificationMessage';
import Avatar from '@/components/library/Avatar';
import { Notification as NotificationBase } from '@/apis';
import { useUsers } from '@/utils/user-utils';
import { dayjs, TIME_FORMAT_WITHOUT_SECONDS, duration } from '@/utils/dayjs';

export type Notification = NotificationBase;

interface Props {
  notification: Notification;
}

export default function NotificationsDrawerItem(props: Props) {
  const { notification } = props;
  const isRead = useMemo(() => {
    return notification.consoleNotificationStatuses?.some((x) => x.status === 'READ') ?? false;
  }, [notification.consoleNotificationStatuses]);
  const [users] = useUsers();
  return (
    <div className={cn(s.root, !isRead && s.isUnread)}>
      <Avatar size="medium" user={users[notification.triggeredBy]} />
      <div className={s.content}>
        <div className={s.message}>
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
