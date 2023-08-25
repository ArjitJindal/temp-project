import { useMutation, useQueryClient } from '@tanstack/react-query';
import _ from 'lodash';
import pluralize from 'pluralize';
import StatusChangeModal, {
  FormValues,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { useApi } from '@/api';
import { AlertStatusUpdateRequest, CaseStatusUpdate } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { CASES_ITEM } from '@/utils/queries/keys';
import { OTHER_REASON } from '@/components/Narrative';

interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {
  caseId?: string;
  transactionIds?: { [alertId: string]: string[] };
}

export default function AlertsStatusChangeModal(props: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [users] = useUsers();
  const user = useAuth0User();

  const currentUser = users[user.userId];
  const isChildCase = props.caseId?.includes('.');
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
        if (updates.alertStatus === 'ESCALATED' && props.caseId && !isChildCase) {
          const caseUpdateRequest: CaseStatusUpdate = updates;
          const { childCaseId, assigneeIds } = await api.postCasesCaseIdEscalate({
            caseId: props.caseId,
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
          const assignees = assigneeIds
            ?.map((assigneeId) => users[assigneeId]?.name || assigneeId)
            .map((name) => `'${name}'`)
            .join(', ');

          const entities = props.entityIds.join(', ');
          if (!currentUser?.reviewerId) {
            if (_.isEmpty(transactionIds)) {
              message.success(
                `Alerts '${entities}' are added to a new child case '${childCaseId}' and escalated successfully to ${assignees}`,
              );
            } else {
              message.success(
                `Selected transactions from alerts are added to new child case '${childCaseId}' with respective child alerts and escalated successfully to ${assignees}.`,
              );
            }
          }
          await queryClient.invalidateQueries({ queryKey: CASES_ITEM(props.caseId) });
        } else {
          await api.alertsStatusChange({
            AlertsStatusUpdateRequest: {
              alertIds: props.entityIds,
              updates,
            },
          });
          if (!currentUser?.reviewerId) {
            message.success('Saved');
          }
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
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.error(`Failed to update the alert! ${getErrorMessage(e)}`);
      },
    },
  );

  const transactionIds = Object.values(props.transactionIds ?? {}).flatMap((v) => v);
  const entityIds = _.isEmpty(transactionIds) ? props.entityIds : transactionIds;
  return (
    <StatusChangeModal
      {...props}
      key={String(props.isVisible)}
      entityIds={entityIds}
      entityName={_.isEmpty(transactionIds) ? 'alert' : 'transaction'}
      updateMutation={updateMutation}
      displayCloseRelatedCases={!isChildCase}
    />
  );
}
