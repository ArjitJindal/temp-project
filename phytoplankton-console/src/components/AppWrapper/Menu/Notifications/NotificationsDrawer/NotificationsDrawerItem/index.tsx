import React, { useMemo } from 'react';
import cn from 'clsx';
import { useNavigate } from 'react-router';
import s from './index.module.less';
import NotificationMessage from './NotificationMessage';
import Avatar from '@/components/library/Avatar';
import { Account, Notification as NotificationBase } from '@/apis';
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
  users: {
    [userId: string]: Account;
  };
}

export default function NotificationsDrawerItem(props: Props) {
  const { notification, markAsReadMutation, innerRef, users } = props;
  const isRead = useMemo(() => {
    return notification.consoleNotificationStatuses?.some((x) => x.status === 'READ') ?? false;
  }, [notification.consoleNotificationStatuses]);

  function handleReadNotification(notificationId) {
    markAsReadMutation.mutate({ notificationId });
  }

  const navigate = useNavigate();

  return (
    <div
      className={cn(s.root, !isRead && s.isUnread)}
      onClick={() => {
        navigate(getNotificationUrl(notification));
        if (notification.consoleNotificationStatuses?.some((x) => x.status === 'SENT')) {
          handleReadNotification(notification.id);
        }
      }}
      ref={innerRef}
    >
      <Avatar size="medium" user={users[notification.triggeredBy]} />
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
  const { entityId, entityType, notificationType, metadata } = notification;
  if (notificationType === 'RISK_CLASSIFICATION_APPROVAL') {
    return '/risk-levels/configure';
  }
  if (notificationType === 'RISK_FACTORS_APPROVAL') {
    // Extract risk factor ID and type from notification data and navigate to the risk factor
    const riskFactorId = notification.notificationData?.approval?.id;
    const riskFactorType = notification.notificationData?.approval?.riskFactorType;
    if (riskFactorId) {
      // Map the risk factor type to the URL parameter
      let typeParam = 'consumer'; // Default
      if (riskFactorType === 'CONSUMER_USER') {
        typeParam = 'consumer';
      } else if (riskFactorType === 'BUSINESS') {
        typeParam = 'business';
      } else if (riskFactorType === 'TRANSACTION') {
        typeParam = 'transaction';
      }
      return `/risk-levels/risk-factors/${typeParam}/${riskFactorId}/read`;
    }
    return '/risk-levels/risk-factors';
  }
  if (notificationType === 'USER_CHANGES_APPROVAL') {
    const userId = notification.notificationData?.approval?.userId;
    return userId ? `/users/list/all/${userId}` : '#';
  }
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
