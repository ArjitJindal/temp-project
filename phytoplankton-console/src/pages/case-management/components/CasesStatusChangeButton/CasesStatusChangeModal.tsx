import React from 'react';
import { useMutation } from '@tanstack/react-query';
import StatusChangeModal, {
  FormValues,
  OTHER_REASON,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { useApi } from '@/api';
import { CaseUpdateRequest } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useUsers } from '@/utils/user-utils';

interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {}

export default function CasesStatusChangeModal(props: Props) {
  const api = useApi();
  const [users] = useUsers();
  const updateMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      const hideMessage = message.loading(`Saving...`);

      const updates: CaseUpdateRequest = {
        caseStatus: props.newStatus,
      };

      if (formValues) {
        updates.otherReason =
          formValues.reasons.indexOf(OTHER_REASON) !== -1
            ? formValues.reasonOther ?? ''
            : undefined;
        updates.reason = formValues.reasons;
        updates.files = formValues.files;
        updates.comment = formValues.comment ?? undefined;
      }

      try {
        if (updates.caseStatus === 'ESCALATED') {
          if (props.entityIds.length !== 1) {
            message.error('Can only escalate a single case at a time');
            return;
          }
          const { assigneeIds } = await api.postCasesCaseIdEscalate({
            caseId: props.entityIds[0],
            CaseEscalationRequest: {
              caseUpdateRequest: updates,
            },
          });
          const assignees = assigneeIds
            ?.map((assigneeId) => users[assigneeId]?.name || assigneeId)
            .map((name) => `'${name}'`)
            .join(', ');
          message.success(
            `Case '${props.entityIds[0]}' is escalated successfully to ${assignees}. Please note that all 'Open' alert statuses are changed to 'Escalated'.`,
          );
        } else {
          await api.postCases({
            CasesUpdateRequest: {
              caseIds: props.entityIds,
              updates: updates,
            },
          });
          if (props.newStatusActionLabel === 'Send back') {
            const c = await api.getCase({
              caseId: props.entityIds[0],
            });
            const assignees = c.assignments
              ?.map(
                (assignment) => users[assignment.assigneeUserId]?.name || assignment.assigneeUserId,
              )
              .map((name) => `'${name}'`)
              .join(', ');
            message.success(
              `Case '${props.entityIds[0]}' and the alerts under it are sent back successfully to ${assignees}. The case status and all 'Escalated' alert statuses under it are changed to 'Open'.`,
            );
          } else {
            message.success('Saved');
          }
        }
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.fatal(`Failed to update the case! ${getErrorMessage(e)}`, e);
      },
    },
  );

  return <StatusChangeModal {...props} entityName="case" updateMutation={updateMutation} />;
}
