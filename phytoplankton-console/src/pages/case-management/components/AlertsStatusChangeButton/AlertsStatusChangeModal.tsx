import { useMutation, useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import { isEmpty } from 'lodash';
import { useCallback } from 'react';
import StatusChangeModal, {
  FormValues,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { useApi } from '@/api';
import { AlertStatusUpdateRequest, CaseStatusUpdate } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useCurrentUser, useUsers } from '@/utils/user-utils';
import { ALERT_CHECKLIST, ALERT_ITEM, CASES_ITEM } from '@/utils/queries/keys';
import { OTHER_REASON } from '@/components/Narrative';
import { getAssigneeName, statusEscalated, statusEscalatedL2 } from '@/utils/case-utils';

export interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {
  caseId?: string;
  transactionIds?: { [alertId: string]: string[] };
  onSaved: () => void;
}

const isEscatedTimes = (caseId: string, times: number) => {
  return caseId?.split('.').length >= times + 1;
};

export default function AlertsStatusChangeModal(props: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [users] = useUsers();
  const currentUser = useCurrentUser();
  const escalatedCaseCallback = useCallback(
    async (formValues: FormValues, updates: AlertStatusUpdateRequest) => {
      const caseUpdateRequest: CaseStatusUpdate = updates;
      const { childCaseId, assigneeIds } = await api.postCasesCaseIdEscalate({
        caseId: props.caseId as string,
        CaseEscalationRequest: {
          closeSourceCase: formValues.closeRelatedCase,
          caseUpdateRequest,
          alertEscalations: props.entityIds.map((alertId) => {
            return {
              alertId,
              transactionIds: props.transactionIds ? props.transactionIds[alertId] : [],
            };
          }),
        },
      });

      const transactionIds = Object.values(props.transactionIds ?? {})
        .flatMap((v) => v)
        .filter(Boolean);

      const assignees = getAssigneeName(users, assigneeIds, updates.alertStatus);

      const entities = props.entityIds.join(', ');
      if (!currentUser?.reviewerId) {
        if (isEmpty(transactionIds)) {
          if (childCaseId) {
            message.success(
              `Alerts '${entities}' are added to a new child case '${childCaseId}' and ${
                statusEscalatedL2(updates.alertStatus) ? 'escalated l2' : 'escalated'
              } successfully to ${assignees}`,
            );
          } else {
            message.success(
              `Alerts '${entities}' ${
                statusEscalatedL2(updates.alertStatus) ? 'escalated l2' : 'escalated'
              } successfully to ${assignees}`,
            );
          }
        } else {
          if (childCaseId) {
            message.success(
              `Selected transactions from alerts are added to new child case '${childCaseId}' with respective child alerts and escalated successfully to ${assignees}.`,
            );
          } else {
            message.success(
              `Selected transactions from alerts are escalated successfully to ${assignees}.`,
            );
          }
        }
      }
      await queryClient.invalidateQueries({ queryKey: CASES_ITEM(props.caseId as string) });
    },
    [props.caseId, props.entityIds, props.transactionIds, api, currentUser, queryClient, users],
  );

  const statusChangeCallback = useCallback(
    async (updates: AlertStatusUpdateRequest) => {
      await api.alertsStatusChange({
        AlertsStatusUpdateRequest: {
          alertIds: props.entityIds,
          updates,
        },
      });
      props.entityIds.forEach((alertId) => {
        queryClient.refetchQueries({ queryKey: ALERT_ITEM(alertId) });
      });
      if (!currentUser?.reviewerId) {
        message.success('Saved');
      }

      if (currentUser?.reviewerId) {
        message.warn(
          `${pluralize('Alert', props.entityIds.length, true)} ${props.entityIds.join(', ')} ${
            props.entityIds.length > 1 ? 'are' : 'is'
          } sent to review ${
            users[currentUser.reviewerId]?.name ||
            users[currentUser.reviewerId]?.email ||
            currentUser?.reviewerId
          }. Once approved your alert action will be performed successfully.`,
        );
        return;
      }
    },
    [props.entityIds, api, currentUser?.reviewerId, queryClient, users],
  );

  const updateMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      const hideMessage = message.loading(`Saving...`);

      const updates: AlertStatusUpdateRequest = {
        alertStatus: props.newStatus,
        reason: formValues?.reasons ?? [],
      };

      if (formValues) {
        updates.otherReason =
          formValues.reasons.indexOf(OTHER_REASON) !== -1
            ? formValues.reasonOther ?? ''
            : undefined;
        updates.files = formValues.files;
        updates.comment = formValues.comment ?? undefined;
      }

      try {
        if (statusEscalated(updates.alertStatus) && props.caseId) {
          if (statusEscalated(props.oldStatus) && !statusEscalatedL2(updates.alertStatus)) {
            await statusChangeCallback(updates);
          } else if (statusEscalatedL2(updates.alertStatus) && !isEscatedTimes(props.caseId, 2)) {
            await escalatedCaseCallback(formValues, updates);
          } else if (
            !isEscatedTimes(props.caseId, 1) &&
            statusEscalated(updates.alertStatus) &&
            !statusEscalatedL2(updates.alertStatus)
          ) {
            await escalatedCaseCallback(formValues, updates);
          } else {
            await statusChangeCallback(updates);
          }
        } else {
          await statusChangeCallback(updates);
        }
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.error(`Failed to update the alert! ${getErrorMessage(e)}`);
      },
      onSuccess: async () => {
        await Promise.all(
          props.entityIds.map((alertId) => {
            queryClient.invalidateQueries({ queryKey: ALERT_CHECKLIST(alertId) });
          }),
        );
        props.onSaved();
      },
    },
  );

  const transactionIds = Object.values(props.transactionIds ?? {}).flatMap((v) => v);
  const entityIds = isEmpty(transactionIds) ? props.entityIds : transactionIds;
  return (
    <StatusChangeModal
      {...props}
      key={String(props.isVisible)}
      entityIds={entityIds}
      entityName={isEmpty(transactionIds) ? 'ALERT' : 'TRANSACTION'}
      updateMutation={updateMutation}
      displayCloseRelatedCases={!isEscatedTimes(props.caseId as string, 1)}
    />
  );
}
