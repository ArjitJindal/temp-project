import React, { useMemo } from 'react';
import s from './index.module.less';
import { getDisplayedUserInfo, useUsers } from '@/utils/user-utils';
import { neverReturn } from '@/utils/lang';
import { Notification } from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer/NotificationsDrawerItem';
import { getNextStatus, statusEscalated, statusInReview } from '@/utils/case-utils';
import Button from '@/components/library/Button';
import { useSendProposalActionMutation } from '@/pages/risk-levels/configure/RiskClassification/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { map, success } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { usePendingProposal } from '@/pages/risk-levels/configure/utils';

interface Props {
  notification: Notification;
}

export default function NotificationMessage(props: Props) {
  const { notification } = props;
  const sendProposalActionMutation = useSendProposalActionMutation();

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const { data: pendingProposalRes } = usePendingProposal();
  const isPendingApprovalRes = useMemo(() => {
    if (!isApprovalWorkflowsEnabled) {
      return success(false);
    }
    return map(pendingProposalRes, (value) => value != null);
  }, [isApprovalWorkflowsEnabled, pendingProposalRes]);

  if (
    notification.notificationType === 'ALERT_COMMENT_MENTION' ||
    notification.notificationType === 'CASE_COMMENT_MENTION' ||
    notification.notificationType === 'USER_COMMENT_MENTION'
  ) {
    return (
      <>
        <Author {...props} />
        {' mentioned you in a comment for '}
        <Entity {...props} />.
      </>
    );
  } else if (
    notification.notificationType === 'ALERT_COMMENT' ||
    notification.notificationType === 'CASE_COMMENT'
  ) {
    return (
      <>
        <Author {...props} />
        {' added a comment for '}
        <Entity {...props} />.
      </>
    );
  } else if (
    notification.notificationType === 'CASE_ESCALATION' ||
    notification.notificationType === 'ALERT_ESCALATION'
  ) {
    return (
      <>
        <Author {...props} />
        {' escalated '}
        <Entity {...props} />
        {' to you.'}
      </>
    );
  } else if (
    notification.notificationType === 'CASE_ASSIGNMENT' ||
    notification.notificationType === 'ALERT_ASSIGNMENT'
  ) {
    return (
      <>
        <Author {...props} />
        {' assigned '}
        <Entity {...props} />
        {' to you.'}
      </>
    );
  } else if (
    notification.notificationType === 'CASE_UNASSIGNMENT' ||
    notification.notificationType === 'ALERT_UNASSIGNMENT'
  ) {
    return (
      <>
        <Author {...props} />
        {' unassigned '}
        <Entity {...props} />
        {' from you.'}
      </>
    );
  } else if (
    notification.notificationType === 'CASE_IN_REVIEW' ||
    notification.notificationType === 'ALERT_IN_REVIEW'
  ) {
    return (
      <>
        <Author {...props} />
        {' moved '}
        <Entity {...props} />
        {' for you to review'}
      </>
    );
  } else if (
    notification.notificationType === 'ALERT_STATUS_UPDATE' ||
    notification.notificationType === 'CASE_STATUS_UPDATE'
  ) {
    const oldStatus = notification.notificationData.oldStatus;
    const newStatus = notification.notificationData.status;
    let message: string = '';
    if (statusInReview(oldStatus)) {
      message = getNextStatus(oldStatus) === newStatus ? ' approved and' : ' rejected and';
    }
    if (statusEscalated(oldStatus)) {
      message = getNextStatus(oldStatus) === newStatus ? '' : ' sent back and';
    }
    return (
      <>
        <Author {...props} />
        {message}
        {' changed status of '}
        <Entity {...props} />
      </>
    );
  } else if (notification.notificationType === 'RISK_CLASSIFICATION_APPROVAL') {
    return (
      <>
        <Author {...props} />
        {' updated '}
        <Entity {...props} />
        {'and waiting for approval'}
        <AsyncResourceRenderer resource={isPendingApprovalRes}>
          {(isPendingApproval) =>
            isPendingApproval ? (
              <div
                className={s.buttons}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Button
                  type={'PRIMARY'}
                  onClick={() => {
                    sendProposalActionMutation.mutate({ action: 'accept' });
                  }}
                >
                  Accept
                </Button>
                <Button
                  type={'DANGER'}
                  onClick={() => {
                    sendProposalActionMutation.mutate({ action: 'reject' });
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : (
              <></>
            )
          }
        </AsyncResourceRenderer>
      </>
    );
  } else {
    return neverReturn(
      notification.notificationType,
      <>
        Notification from <Author {...props} />
      </>,
    );
  }
}

function Entity(props: Props) {
  const { notification } = props;

  let label;
  if (notification.entityType === 'ALERT') {
    label = 'an alert ';
  } else if (notification.entityType === 'CASE') {
    label = 'a case ';
  } else if (notification.entityType === 'USER') {
    label = 'a user ';
  } else if (notification.entityType === 'RISK_LEVELS') {
    label = 'a risk levels ';
  } else {
    label = neverReturn(notification.entityType, 'unknown object');
  }

  return (
    <>
      {label}
      <EntityId {...props} />
    </>
  );
}

function EntityId(props: Props) {
  const { notification } = props;
  return <b>‘{notification.entityId}’</b>;
}

function Author(props: Props) {
  const { notification } = props;
  const [users] = useUsers({
    includeRootUsers: true,
  });
  const user = users[notification.triggeredBy];
  return <b>‘{getDisplayedUserInfo(user).name}’</b>;
}
