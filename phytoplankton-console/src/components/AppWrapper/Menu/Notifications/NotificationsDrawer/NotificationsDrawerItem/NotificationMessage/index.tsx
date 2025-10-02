import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import s from './index.module.less';
import { getDisplayedUserInfo, useUsers } from '@/utils/user-utils';
import { neverReturn } from '@/utils/lang';
import { Notification } from '@/components/AppWrapper/Menu/Notifications/NotificationsDrawer/NotificationsDrawerItem';
import { getNextStatus, statusEscalated, statusInReview } from '@/utils/case-utils';
import Button from '@/components/library/Button';
import { useSendProposalActionMutation as useSendRiskLevelsProposalActionMutation } from '@/pages/risk-levels/configure/RiskClassification/helpers';
import { useSendProposalActionMutation as useSendRiskFactorsProposalActionMutation } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/ApprovalHeader/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useRiskClassificationWorkflowProposal } from '@/hooks/api';
import { map, success } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  notification: Notification;
}

export default function NotificationMessage(props: Props) {
  const { notification } = props;
  const navigate = useNavigate();
  const sendRiskLevelsProposalActionMutation = useSendRiskLevelsProposalActionMutation();
  const sendRiskFactorsProposalActionMutation = useSendRiskFactorsProposalActionMutation();

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const { data: pendingProposalRes } = useRiskClassificationWorkflowProposal({
    enabled: isApprovalWorkflowsEnabled,
  });
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
                    sendRiskLevelsProposalActionMutation.mutate({ action: 'accept' });
                  }}
                >
                  Accept
                </Button>
                <Button
                  type={'DANGER'}
                  onClick={() => {
                    sendRiskLevelsProposalActionMutation.mutate({ action: 'reject' });
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
  } else if (notification.notificationType === 'RISK_FACTORS_APPROVAL') {
    // Extract risk factor ID from the notification data
    const riskFactorId = notification.notificationData?.approval?.id;

    return (
      <>
        <Author {...props} />
        {' updated '}
        <Entity {...props} />
        {'and waiting for approval'}
        {riskFactorId && (
          <div
            className={s.buttons}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Button
              type={'PRIMARY'}
              onClick={() => {
                sendRiskFactorsProposalActionMutation.mutate({
                  riskFactorId,
                  action: 'accept',
                });
              }}
            >
              Accept
            </Button>
            <Button
              type={'DANGER'}
              onClick={() => {
                sendRiskFactorsProposalActionMutation.mutate({
                  riskFactorId,
                  action: 'reject',
                });
              }}
            >
              Reject
            </Button>
          </div>
        )}
      </>
    );
  } else if (notification.notificationType === 'USER_CHANGES_APPROVAL') {
    // Extract user approval ID from the notification data
    const approvalId = notification.notificationData?.approval?.id;
    const userId = notification.notificationData?.approval?.userId;

    return (
      <>
        <Author {...props} />
        {' updated '}
        <Entity {...props} />
        {'and waiting for approval'}
        {approvalId && userId && (
          <div
            className={s.buttons}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Button
              type={'PRIMARY'}
              onClick={() => {
                // Navigate to the user page where the approval modal can be opened
                navigate(`/users/list/all/${userId}`);
              }}
            >
              View Changes
            </Button>
          </div>
        )}
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
  } else if (notification.entityType === 'RISK_FACTORS') {
    label = 'a risk factor ';
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
