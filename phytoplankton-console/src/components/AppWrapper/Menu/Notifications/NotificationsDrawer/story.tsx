import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { UseCase } from '@/pages/storybook/components';
import NotificationsDrawerItem, {
  Notification,
} from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer/NotificationsDrawerItem';
import NotificationsDrawer from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import { useUsers } from '@/utils/api/auth';
import { NotificationType, Account } from '@/apis';
import { success } from '@/utils/asyncResource';
import { neverReturn } from '@/utils/lang';

export default function (): JSX.Element {
  const { users } = useUsers();
  return (
    <>
      <UseCase
        title="Drawer"
        initialState={{
          isVisible: false,
          notifications: [],
          newNotificationType: 'CASE_ASSIGNMENT',
        }}
      >
        {([state, setState]) => (
          <>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Select
                placeholder="Notification type"
                allowClear={false}
                options={[
                  'CASE_ASSIGNMENT',
                  'ALERT_ASSIGNMENT',
                  'CASE_UNASSIGNMENT',
                  'ALERT_UNASSIGNMENT',
                  'CASE_ESCALATION',
                  'ALERT_ESCALATION',
                  'ALERT_COMMENT_MENTION',
                  'CASE_COMMENT_MENTION',
                  'USER_COMMENT_MENTION',
                  'CASE_IN_REVIEW',
                  'ALERT_IN_REVIEW',
                  'ALERT_COMMENT',
                  'CASE_COMMENT',
                  'ALERT_STATUS_UPDATE',
                  'CASE_STATUS_UPDATE',
                ].map((notificationType) => ({
                  value: notificationType,
                  label: humanizeConstant(notificationType),
                }))}
                value={state.newNotificationType}
                onChange={(newNotificationType) => {
                  setState((prevState) => ({ ...prevState, newNotificationType }));
                }}
              />
              <Button
                onClick={() => {
                  const notification = sampleNotification(
                    state.newNotificationType,
                    Object.values(users),
                  );
                  setState((prevState) => ({
                    ...prevState,
                    notifications: [notification, ...prevState.notifications],
                  }));
                }}
              >
                Create "{humanizeConstant(state.newNotificationType)}" notification
              </Button>
            </div>
            {state.notifications.map((notification) => (
              <NotificationsDrawerItem
                key={notification.id}
                notification={notification}
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                markAsReadMutation={() => {
                  setState((prevState) => ({
                    ...prevState,
                    notifications: prevState.notifications.map((x) => ({
                      ...x,
                      consoleNotificationStatuses: [
                        ...(x.consoleNotificationStatuses ?? []),
                        {
                          status: 'READ',
                          stausUpdatedAt: Date.now(),
                          recieverUserId: '1',
                        },
                      ],
                    })),
                  }));
                }}
              />
            ))}
            <Button
              onClick={() => {
                setState((prevState) => ({ ...prevState, isVisible: !prevState.isVisible }));
              }}
            >
              Show in drawer
            </Button>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                pointerEvents: state.isVisible ? undefined : 'none',
              }}
            >
              <NotificationsDrawer
                data={success({
                  pages: [
                    {
                      items: state.notifications ?? [],
                      next: '',
                      prev: '',
                      hasNext: false,
                      hasPrev: false,
                      last: '',
                      count: 0,
                      limit: 1000,
                    },
                  ],
                  pageParams: [],
                })}
                refetch={() => {}}
                setTab={() => {}}
                tab="ALL"
                isVisible={state.isVisible}
                onChangeVisibility={(isShown) => {
                  setState((prevState) => ({ ...prevState, isVisible: isShown }));
                }}
                setHasUnreadNotifications={(_trueOrFalse) => {}}
                invalidateAll={async () => {}}
              />
            </div>
          </>
        )}
      </UseCase>
    </>
  );
}

function sampleNotification(notificationType: NotificationType, users: Account[]) {
  const usersList = Object.values(users);
  const randomUser1 = usersList[Math.floor(Math.random() * usersList.length)];
  const randomUser2 = usersList[Math.floor(Math.random() * usersList.length)];
  let entityType;
  switch (notificationType) {
    case 'CASE_ASSIGNMENT':
    case 'CASE_UNASSIGNMENT':
    case 'CASE_ESCALATION':
    case 'CASE_COMMENT_MENTION':
    case 'CASE_IN_REVIEW':
    case 'CASE_STATUS_UPDATE':
    case 'CASE_COMMENT':
      entityType = 'CASE';
      break;
    case 'ALERT_ASSIGNMENT':
    case 'ALERT_UNASSIGNMENT':
    case 'ALERT_ESCALATION':
    case 'ALERT_COMMENT_MENTION':
    case 'ALERT_COMMENT':
    case 'ALERT_IN_REVIEW':
    case 'ALERT_STATUS_UPDATE':
      entityType = 'ALERT';
      break;
    case 'USER_COMMENT_MENTION':
      entityType = 'USER';
      break;
    case 'RISK_CLASSIFICATION_APPROVAL':
    case 'RISK_FACTORS_APPROVAL':
      entityType = 'USER';
      break;
    case 'USER_CHANGES_APPROVAL':
      entityType = 'USER';
      break;
    default:
      entityType = neverReturn(notificationType, null);
  }
  const notification: Notification = {
    id: `${Date.now()}`,
    notificationType: notificationType,
    createdAt: Date.now(),
    triggeredBy: randomUser1?.id,
    recievers: [],
    entityId: `E-${Math.round(Math.random() * 1000)}`,
    entityType: entityType,
    notificationData: null,
    consoleNotificationStatuses: [
      {
        status: 'SENT',
        stausUpdatedAt: 1686312000000,
        recieverUserId: randomUser2.id,
      },
    ],
  };
  return notification;
}
