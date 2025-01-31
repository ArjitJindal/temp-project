import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo } from 'react';
import { useApi } from '@/api';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  getAssignmentsToShow,
  getEscalationLevel,
  isOnHoldOrInProgressOrEscalated,
  statusEscalated,
  statusEscalatedL2,
  statusInProgressOrOnHold,
  statusInReview,
} from '@/utils/case-utils';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import {
  Alert,
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
  CaseStatus,
} from '@/apis';

interface Props {
  alertItem: Alert;
}

export default function AlertAssigneesDropdown(props: Props): JSX.Element {
  const { alertItem } = props;
  const api = useApi();
  const client = useQueryClient();
  const user = useAuth0User();
  const hasEditingPermission = useHasPermissions(['case-management:case-overview:write']);

  const reviewAssignmentsToMutationAlerts = useMutation<
    unknown,
    Error,
    AlertsReviewAssignmentsUpdateRequest
  >(
    async ({ alertIds, reviewAssignments }) => {
      await api.alertsReviewAssignment({
        AlertsReviewAssignmentsUpdateRequest: {
          alertIds,
          reviewAssignments,
        },
      });
    },
    {
      onSuccess: async () => {
        message.success('Review assignees updated successfully');
        await client.invalidateQueries(ALERT_ITEM(alertItem.alertId ?? ''));
      },
      onError: (error) => {
        message.fatal(`Unable to assign alert: ${error.message}`);
      },
    },
  );

  const assignmentsToMutationAlerts = useMutation<unknown, Error, AlertsAssignmentsUpdateRequest>(
    async ({ alertIds, assignments }) => {
      await api.alertsAssignment({
        AlertsAssignmentsUpdateRequest: {
          alertIds,
          assignments,
        },
      });
    },
    {
      onSuccess: async () => {
        message.success('Assignees updated successfully');
        await client.invalidateQueries(ALERT_ITEM(alertItem.alertId ?? ''));
      },
      onError: (error) => {
        message.fatal(`Unable to assign alert: ${error.message}`);
      },
    },
  );

  const handleAlertsReviewAssignments = useCallback(
    (updateRequest: AlertsReviewAssignmentsUpdateRequest) => {
      const { alertIds, reviewAssignments } = updateRequest;

      reviewAssignmentsToMutationAlerts.mutate({
        alertIds,
        reviewAssignments,
      });
    },
    [reviewAssignmentsToMutationAlerts],
  );

  const handleAlertAssignments = useCallback(
    (updateRequest: AlertsAssignmentsUpdateRequest) => {
      const { alertIds, assignments } = updateRequest;

      assignmentsToMutationAlerts.mutate({
        alertIds,
        assignments,
      });
    },
    [assignmentsToMutationAlerts],
  );

  const isMultiEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

  const alertStatus = alertItem.alertStatus;
  const alertId = alertItem.alertId;

  const otherStatuses = useMemo(
    () => isOnHoldOrInProgressOrEscalated(alertStatus as CaseStatus),
    [alertStatus],
  );

  if (alertId == null) {
    return <></>;
  }

  // const selectedAlertStatuses = new Set([alertStatus]);

  if (statusInProgressOrOnHold(alertStatus)) {
    return <></>;
  }

  // this is for multi-level escalation (PNB)
  // if any of the selected alerts have a different escalation level, then we don't allow the assignment
  if (isMultiEscalationEnabled) {
    const isEscalated = statusEscalated(alertStatus) || statusEscalatedL2(alertStatus);

    // if 'ESCALATED' status is present and there's only one case, then
    // reassignment to another user with the same escalation level is allowed
    if (isEscalated) {
      const escalationLevel = getEscalationLevel(alertItem.reviewAssignments ?? []);

      return (
        <AssigneesDropdown
          assignments={getAssignmentsToShow(alertItem) ?? []}
          editing={
            !(statusInReview(alertItem.alertStatus) || otherStatuses) && hasEditingPermission
          }
          onChange={(accounts) => {
            for (const accountId of accounts) {
              handleAlertsReviewAssignments({
                alertIds: [alertId],
                reviewAssignments: [
                  {
                    assigneeUserId: accountId,
                    assignedByUserId: user.userId,
                    timestamp: Date.now(),
                    escalationLevel: escalationLevel,
                  },
                ],
              });
            }
          }}
          fixSelectorHeight
        />
      );
    }
  }

  if (alertStatus === 'ESCALATED') {
    return (
      <AssigneesDropdown
        assignments={getAssignmentsToShow(alertItem) ?? []}
        editing={!(statusInReview(alertItem.alertStatus) || otherStatuses) && hasEditingPermission}
        onChange={(accounts) => {
          for (const accountId of accounts) {
            handleAlertsReviewAssignments({
              alertIds: [alertId],
              reviewAssignments: [
                {
                  assigneeUserId: accountId,
                  assignedByUserId: user.userId,
                  timestamp: Date.now(),
                },
              ],
            });
          }
        }}
        fixSelectorHeight
      />
    );
  }
  return (
    <AssigneesDropdown
      assignments={getAssignmentsToShow(alertItem) ?? []}
      editing={!(statusInReview(alertItem.alertStatus) || otherStatuses) && hasEditingPermission}
      onChange={(accounts) => {
        for (const accountId of accounts) {
          handleAlertAssignments({
            alertIds: [alertId],
            assignments: [
              {
                assigneeUserId: accountId,
                assignedByUserId: user.userId,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }}
      fixSelectorHeight
    />
  );
}
