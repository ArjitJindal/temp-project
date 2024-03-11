import React, { useState, useMemo } from 'react';
import s from './index.module.less';
import Drawer from '@/components/library/Drawer';
import SegmentedControl from '@/components/library/SegmentedControl';
import Button from '@/components/library/Button';
import NotificationsDrawerItem, {
  Notification,
} from '@/components/AppWrapper/Menu/NotificationsDrawer/NotificationsDrawerItem';

interface Props {
  notifications: Notification[];
  onReadNotification: (id: string) => void;
  isVisible: boolean;
  onChangeVisibility: (isShown: boolean) => void;
}

export default function NotificationsDrawer(props: Props) {
  const { notifications, isVisible, onChangeVisibility, onReadNotification } = props;
  const [tab, setTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const handleReadAll = () => {
    for (const notification of notifications) {
      onReadNotification(notification.id);
    }
  };

  const unreadNotifications = useMemo(
    () =>
      notifications.filter(
        (x) => !(x.consoleNotificationStatuses ?? []).some(({ status }) => status === 'READ'),
      ),
    [notifications],
  );

  const filteredNotifications = tab === 'UNREAD' ? unreadNotifications : notifications;

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
            onChange={setTab}
            items={[
              { label: 'All', value: 'ALL' },
              { label: 'Unread', value: 'UNREAD' },
            ]}
          />
          {unreadNotifications.length > 0 && (
            <Button type="TEXT" onClick={handleReadAll} size="SMALL">
              {'Mark all as read'}
            </Button>
          )}
        </div>
        <div className={s.scrollContainer}>
          <div className={s.items}>
            {filteredNotifications.length === 0 && (
              <div className={s.empty}>
                {tab === 'UNREAD'
                  ? `You don't have any unread notifications`
                  : `You don't have any notifications`}
              </div>
            )}
            {filteredNotifications.map((notification) => (
              <NotificationsDrawerItem key={notification.id} notification={notification} />
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
