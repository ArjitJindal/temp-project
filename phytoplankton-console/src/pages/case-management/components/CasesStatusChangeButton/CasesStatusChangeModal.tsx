import React, { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import StatusChangeModal, {
  FormValues,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { useApi } from '@/api';
import { CaseStatusUpdate } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useCurrentUser, useUsers } from '@/utils/user-utils';
import { OTHER_REASON } from '@/components/Narrative';
import { getAssigneeName, statusEscalated, statusEscalatedL2 } from '@/utils/case-utils';
import { UserStatusTriggersAdvancedOptionsForm } from '@/components/UserStatusTriggersAdvancedOptionsForm';
import { ALERT_CHECKLIST, CASE_AUDIT_LOGS_LIST } from '@/utils/queries/keys';

interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {
  onSaved: () => void;
}

export default function CasesStatusChangeModal(props: Props) {
  const api = useApi();
  const [users] = useUsers();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const escalationCallback = useCallback(
    async (updates: CaseStatusUpdate) => {
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
      const assignees = getAssigneeName(users, assigneeIds, updates.caseStatus);

      if (currentUser?.reviewerId) {
        return;
      }

      message.success(
        `Case '${
          props.entityIds[0]
        }' is escalated successfully to ${assignees}. Please note that all 'Open' alert statuses are changed to ${humanizeConstant(
          updates.caseStatus as string,
        )}`,
      );
    },
    [api, props.entityIds, users, currentUser?.reviewerId],
  );

  const statusChangeCallback = useCallback(
    async (updates: CaseStatusUpdate) => {
      await api.patchCasesStatusChange({
        CasesStatusUpdateRequest: {
          caseIds: props.entityIds,
          updates: updates,
        },
      });
      if (props.newStatusActionLabel === 'Send back') {
        const c = await api.getCase({
          caseId: props.entityIds[0],
        });
        const sendBackL2Escalated = statusEscalated(updates.caseStatus); // this is so because updates will have the updated status which is L1 for L2 cases
        const assignees = sendBackL2Escalated
          ? c.reviewAssignments
              ?.filter((assignment) => {
                const user = users[assignment.assigneeUserId];
                return user?.escalationLevel === 'L1';
              })
              .map(
                (assignment) =>
                  `'${users[assignment.assigneeUserId]?.name || assignment.assigneeUserId}'`,
              )
              .join(', ')
          : c.assignments
              ?.map(
                (assignment) =>
                  `'${users[assignment.assigneeUserId]?.name || assignment.assigneeUserId}'`,
              )
              .join(', ');

        message.success(
          `Case '${
            props.entityIds[0]
          }' and the alerts under it are sent back successfully to ${assignees}. The case status and all '${
            sendBackL2Escalated ? 'Escalated L2' : 'Escalated'
          }' alert statuses under it are changed to '${
            sendBackL2Escalated ? 'Escalated' : 'Open'
          }'.`,
        );
      } else {
        message.success('Saved');
      }
    },
    [api, props.entityIds, users, props.newStatusActionLabel],
  );
  const updateMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      const hideMessage = message.loading(`Saving...`);

      const updates: CaseStatusUpdate = {
        caseStatus: props.newStatus,
        reason: formValues?.reasons ?? [],
      };

      if (formValues) {
        updates.otherReason =
          formValues.reasons.indexOf(OTHER_REASON) !== -1
            ? formValues.reasonOther ?? ''
            : undefined;
        updates.reason = formValues.reasons;
        updates.files = formValues.files;
        updates.comment = formValues.comment ?? undefined;
        updates.kycStatusDetails = formValues?.kycStatusDetails;
        updates.userStateDetails = formValues?.userStateDetails;
      }

      try {
        if (statusEscalated(updates.caseStatus)) {
          if (statusEscalatedL2(props.oldStatus)) {
            await statusChangeCallback(updates);
          } else {
            await escalationCallback(updates);
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
        message.fatal(`Failed to update the case! ${getErrorMessage(e)}`, e);
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          predicate(query) {
            const checklistQueryKey = ALERT_CHECKLIST('');
            return (
              query.queryKey[0] === checklistQueryKey[0] &&
              query.queryKey[1] === checklistQueryKey[1]
            );
          },
        });
        await queryClient.invalidateQueries(CASE_AUDIT_LOGS_LIST(props.entityIds[0], {}));
        if (currentUser?.reviewerId) {
          message.warn(
            `${pluralize('Case', props.entityIds.length, true)} ${props.entityIds.join(', ')} ${
              props.entityIds.length > 1 ? 'are' : 'is'
            } sent to review ${
              users[currentUser.reviewerId]?.name ||
              users[currentUser.reviewerId]?.email ||
              currentUser?.reviewerId
            }. Once approved your case action will be performed successfully.`,
          );
        }
        props.onSaved();
      },
    },
  );

  return (
    <StatusChangeModal
      {...props}
      key={String(props.isVisible)}
      entityName="CASE"
      updateMutation={updateMutation}
      advancedOptions={
        statusEscalated(props.newStatus) || props.newStatus === 'CLOSED' ? (
          <UserStatusTriggersAdvancedOptionsForm type="CASE" />
        ) : undefined
      }
    />
  );
}
