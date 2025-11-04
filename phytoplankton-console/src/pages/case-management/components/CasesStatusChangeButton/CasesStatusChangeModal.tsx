import React, { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import { capitalizeNameFromEmail, humanizeConstant } from '@flagright/lib/utils/humanize';
import StatusChangeModal, {
  FormValues,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { isAllUsersTableItem } from '../../CaseTable/types';
import { useApi } from '@/api';
import { CaseStatusUpdate, PEPStatus } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useAuth0User, useCurrentUser } from '@/utils/user-utils';
import { useUsers } from '@/utils/api/auth';
import {
  getAssigneeName,
  getStatusChangeUpdatesFromFormValues,
  statusEscalated,
  statusEscalatedL2,
} from '@/utils/case-utils';
import { ALERT_CHECKLIST, CASE_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { CaseEscalateTriggerAdvancedOptionsForm } from '@/components/CaseEscalateTriggerAdvancedOptionsForm';
import { consolidatePEPStatus } from '@/pages/users-item/UserDetails/ConsumerUserDetails/ScreeningDetails/PepStatus/utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { makeUrl } from '@/utils/routing';

export interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {
  onSaved: () => void;
}

export default function CasesStatusChangeModal(props: Props) {
  const api = useApi();
  const auth0User = useAuth0User();
  const { users } = useUsers();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const isNewFeaturesEnabled = useFeatureEnabled('NEW_FEATURES');

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

      // Check if escalation went to review
      if (currentUser?.reviewerId) {
        const caseData = await api.getCase({ caseId: props.entityIds[0] });

        if (caseData.caseStatus?.startsWith('IN_REVIEW_')) {
          const reviewer =
            users[currentUser.reviewerId]?.name ||
            users[currentUser.reviewerId]?.email ||
            currentUser.reviewerId;

          message.warn(
            `${pluralize('Case', props.entityIds.length, true)} ${props.entityIds.join(', ')} ${
              props.entityIds.length > 1 ? 'are' : 'is'
            } sent to review ${reviewer}. Once approved, your case escalation will be performed successfully.`,
          );
          return;
        }
      }

      message.success(`${pluralize('Case', props.entityIds.length)} escalated successfully`, {
        details: `${capitalizeNameFromEmail(auth0User?.name || '')} escalated ${pluralize(
          'case',
          props.entityIds.length,
          true,
        )} '${props.entityIds.join(
          ', ',
        )}' successfully to ${assignees}. Please note that all 'Open' alert statuses are changed to ${humanizeConstant(
          updates.caseStatus as string,
        )}`,
        link: makeUrl(`/case-management/case/:id`, {
          id: props.entityIds[0],
        }),
        linkTitle: 'View case',
      });
    },
    [props.entityIds, api, users, currentUser?.reviewerId, auth0User?.name],
  );

  const statusChangeCallback = useCallback(
    async (updates: CaseStatusUpdate) => {
      await api.patchCasesStatusChange({
        CasesStatusUpdateRequest: {
          caseIds: props.entityIds,
          updates: updates,
        },
      });

      // Note: Toasts are shown after this returns, in the mutation onSuccess handler
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
        message.success(`${pluralize('Case', props.entityIds.length)} sent back successfully`, {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} sent back ${pluralize(
            'case',
            props.entityIds.length,
            true,
          )} '${props.entityIds.join(
            ', ',
          )}' successfully to ${assignees}. The case status and all '${
            sendBackL2Escalated ? 'Escalated L2' : 'Escalated'
          }' alert statuses under it are changed to '${
            sendBackL2Escalated ? 'Escalated' : 'Open'
          }'.`,
          link: makeUrl(`/case-management/case/:id`, {
            id: props.entityIds[0],
          }),
          linkTitle: 'View case',
          copyFeedback: 'Case URL copied to clipboard',
        });
      } else {
        // Fetch the case to check actual status (might be IN_REVIEW_ or direct)
        const caseData = await api.getCase({
          caseId: props.entityIds[0],
        });

        const actualStatus = caseData.caseStatus;
        const wentToReview = actualStatus?.startsWith('IN_REVIEW_');

        if (wentToReview && currentUser?.reviewerId) {
          // Case went to review
          const reviewer =
            users[currentUser.reviewerId]?.name ||
            users[currentUser.reviewerId]?.email ||
            currentUser.reviewerId;

          let reviewMessageText = `${pluralize(
            'Case',
            props.entityIds.length,
            true,
          )} ${props.entityIds.join(', ')} ${
            props.entityIds.length > 1 ? 'are' : 'is'
          } sent to review ${reviewer}. Once approved, your case action will be performed successfully.`;

          if (props.newStatus === 'CLOSED' && updates.updateTransactionStatus) {
            reviewMessageText += ` All transactions which are suspended will be updated to ${
              updates.updateTransactionStatus === 'ALLOW' ? 'allowed' : 'blocked'
            } after the approval of your case action.`;
          }

          message.warn(reviewMessageText);
        } else {
          // Case closed/escalated directly
          let messageText = `${capitalizeNameFromEmail(
            auth0User?.name || '',
          )} ${props.newStatus.toLowerCase()} the case ${props.entityIds[0]} ${
            updates.reason.length ? `as '${updates.reason.join(', ')}'` : ''
          }`;

          if (props.newStatus === 'CLOSED' && updates.updateTransactionStatus) {
            messageText += ` All suspended transactions will be updated to '${
              updates.updateTransactionStatus === 'ALLOW' ? 'Allowed' : 'Blocked'
            }' shortly.`;
          }

          message.success(
            `${pluralize(
              'Case',
              props.entityIds.length,
            )} ${props.newStatus.toLowerCase()} successfully`,
            {
              details: messageText,
              link: makeUrl(`/case-management/case/:id`, {
                id: props.entityIds[0],
              }),
              linkTitle: 'View case',
              copyFeedback: 'Case URL copied to clipboard',
            },
          );
        }
      }
    },
    [
      api,
      props.entityIds,
      props.newStatusActionLabel,
      props.newStatus,
      users,
      auth0User?.name,
      currentUser?.reviewerId,
    ],
  );
  const updateMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      const hideMessage = message.loading(`Saving...`);

      let updates: CaseStatusUpdate = {
        caseStatus: props.newStatus,
        reason: formValues?.reasons ?? [],
        files: formValues?.files ?? [],
        updateTransactionStatus: formValues?.updateTransactionStatus,
      };

      updates = getStatusChangeUpdatesFromFormValues<CaseStatusUpdate>(
        updates,
        isNewFeaturesEnabled,
        props.user,
        formValues,
      );

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
      onSuccess: async (_, _variables) => {
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

        // Toast messages are now handled in statusChangeCallback based on actual case status
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
        isNewFeaturesEnabled &&
        (statusEscalated(props.newStatus) || props.newStatus === 'CLOSED') &&
        props.user &&
        props.entityIds.length === 1 && <CaseEscalateTriggerAdvancedOptionsForm user={props.user} />
      }
      initialValues={{
        tags: props.user?.tags ?? [],
        ...(props.user &&
          !isAllUsersTableItem(props?.user) &&
          props?.user?.type === 'CONSUMER' && {
            screeningDetails: {
              pepStatus: [
                {} as PEPStatus,
                ...(consolidatePEPStatus(props?.user?.pepStatus ?? []) as PEPStatus[]),
              ],
              sanctionsStatus: props?.user?.sanctionsStatus,
              adverseMediaStatus: props?.user?.adverseMediaStatus,
            },
          }),
      }}
    />
  );
}
