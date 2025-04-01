import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApi } from '@/api';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { canAssignToUser, createAssignments, getAssignmentsToShow } from '@/utils/case-utils';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import {
  Alert,
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
} from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  alertItem: Alert;
}

export default function AlertAssigneesDropdown(props: Props): JSX.Element {
  const { alertItem } = props;
  const api = useApi();
  const client = useQueryClient();
  const user = useAuth0User();
  const hasEditingPermission = useHasPermissions(['case-management:case-overview:write']);
  const isMultiEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

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

  const alertStatus = alertItem.alertStatus;
  const alertId = alertItem.alertId;

  if (alertId == null) {
    return <></>;
  }

  return (
    <AssigneesDropdown
      assignments={getAssignmentsToShow(alertItem) ?? []}
      editing={!(alertStatus === 'CLOSED') && hasEditingPermission}
      customFilter={(account) =>
        canAssignToUser(alertStatus ?? 'OPEN', account, isMultiEscalationEnabled)
      }
      onChange={(accounts) => {
        const [assignments, isReview] = createAssignments(
          alertStatus ?? 'OPEN',
          accounts,
          isMultiEscalationEnabled,
          user?.userId ?? '',
        );

        if (alertId == null) {
          message.fatal('Alert ID is null');
          return;
        }

        if (isReview) {
          handleAlertsReviewAssignments({
            alertIds: [alertId],
            reviewAssignments: assignments,
          });
        } else {
          handleAlertAssignments({
            alertIds: [alertId],
            assignments,
          });
        }
      }}
      fixSelectorHeight
    />
  );
}
