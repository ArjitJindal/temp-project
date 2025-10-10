import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApi } from '@/api';
import { useAuth0User, useHasResources } from '@/utils/user-utils';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { canAssignToUser, createAssignments, getAssignmentsToShow } from '@/utils/case-utils';
import { AssigneesDropdown } from '@/components/AssigneesDropdown';
import {
  Alert,
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
} from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { all } from '@/utils/asyncResource';

interface Props {
  alertItem: Alert;
}

export default function AlertAssigneesDropdown(props: Props): JSX.Element {
  const { alertItem } = props;
  const api = useApi();
  const client = useQueryClient();
  const user = useAuth0User();
  const hasEditingPermission = useHasResources(['write:::case-management/case-overview/*']);
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
    async (updateRequest: AlertsReviewAssignmentsUpdateRequest) => {
      const { alertIds, reviewAssignments } = updateRequest;

      await reviewAssignmentsToMutationAlerts.mutateAsync({
        alertIds,
        reviewAssignments,
      });
    },
    [reviewAssignmentsToMutationAlerts],
  );

  const handleAlertAssignments = useCallback(
    async (updateRequest: AlertsAssignmentsUpdateRequest) => {
      const { alertIds, assignments } = updateRequest;

      await assignmentsToMutationAlerts.mutateAsync({
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
      mutationRes={all([
        reviewAssignmentsToMutationAlerts.dataResource,
        assignmentsToMutationAlerts.dataResource,
      ])}
      customFilter={(account) =>
        canAssignToUser(alertStatus ?? 'OPEN', account, isMultiEscalationEnabled)
      }
      onChange={async (accounts) => {
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
          await handleAlertsReviewAssignments({
            alertIds: [alertId],
            reviewAssignments: assignments,
          });
        } else {
          await handleAlertAssignments({
            alertIds: [alertId],
            assignments,
          });
        }
      }}
    />
  );
}
