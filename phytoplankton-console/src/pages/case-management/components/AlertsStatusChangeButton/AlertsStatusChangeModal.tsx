import { useMutation, useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import { isEmpty } from 'lodash';
import { useCallback } from 'react';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import StatusChangeModal, {
  FormValues,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { TableUser } from '../../CaseTable/types';
import { useApi } from '@/api';
import { AlertStatusUpdateRequest, CaseStatusUpdate, PEPStatus } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useAuth0User, useCurrentUser, useUsers } from '@/utils/user-utils';
import { ALERT_CHECKLIST, ALERT_ITEM, CASES_ITEM } from '@/utils/queries/keys';
import {
  getAssigneeName,
  getStatusChangeUpdatesFromFormValues,
  statusEscalated,
  statusEscalatedL2,
} from '@/utils/case-utils';
import { CaseEscalateTriggerAdvancedOptionsForm } from '@/components/CaseEscalateTriggerAdvancedOptionsForm';
import { consolidatePEPStatus } from '@/pages/users-item/UserDetails/ConsumerUserDetails/ScreeningDetails/PepStatus/utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { makeUrl } from '@/utils/routing';

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
  const auth0User = useAuth0User();
  const currentUser = useCurrentUser();
  const isNewFeaturesEnabled = useFeatureEnabled('NEW_FEATURES');

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
              `${pluralize('Alert', props.entityIds.length)} ${
                statusEscalatedL2(updates.alertStatus) ? 'escalated l2' : 'escalated'
              } successfully`,
              {
                details: `${capitalizeNameFromEmail(auth0User?.name || '')} added ${pluralize(
                  'alert',
                  props.entityIds.length,
                  true,
                )} '${entities}' to a new child case '${childCaseId}' and ${
                  statusEscalatedL2(updates.alertStatus) ? 'escalated l2' : 'escalated'
                } successfully to ${assignees}`,
                link: makeUrl(`/case-management/alerts/:id`, {
                  id: props.entityIds[0],
                }),
                linkTitle: 'View alert',
                copyFeedback: 'Alert URL copied to clipboard',
              },
            );
          } else {
            message.success(
              `${pluralize('Alert', props.entityIds.length)} ${
                statusEscalatedL2(updates.alertStatus) ? 'escalated l2' : 'escalated'
              } successfully`,
              {
                details: `${capitalizeNameFromEmail(auth0User?.name || '')} ${
                  statusEscalatedL2(updates.alertStatus) ? 'escalated l2' : 'escalated'
                } ${pluralize(
                  'alert',
                  props.entityIds.length,
                  true,
                )} '${entities}' successfully to ${assignees}`,
                link: makeUrl(`/case-management/alerts/:id`, {
                  id: props.entityIds[0],
                }),
                linkTitle: 'View alert',
                copyFeedback: 'Alert URL copied to clipboard',
              },
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
      for (const alertId of props.entityIds) {
        await queryClient.invalidateQueries({ queryKey: ALERT_ITEM(alertId) });
      }
    },
    [
      api,
      props.caseId,
      props.entityIds,
      props.transactionIds,
      users,
      currentUser?.reviewerId,
      queryClient,
      auth0User?.name,
    ],
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
        message.success(`Alert ${props.newStatus.toLowerCase()} successfully`, {
          details: `${capitalizeNameFromEmail(
            auth0User?.name || '',
          )} ${props.newStatus.toLowerCase()} the alert ${props.entityIds[0]} ${
            updates.reason.length ? `as '${updates.reason.join(', ')}'` : ''
          }`,
          link: makeUrl(`/case-management/alerts/:id`, {
            id: props.entityIds[0],
          }),
          linkTitle: 'View alert',
          copyFeedback: 'Alert URL copied to clipboard',
        });
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
    [
      api,
      props.entityIds,
      props.newStatus,
      currentUser?.reviewerId,
      queryClient,
      auth0User?.name,
      users,
    ],
  );

  const updateMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      const hideMessage = message.loading(`Saving...`);

      let updates: AlertStatusUpdateRequest = {
        alertStatus: props.newStatus,
        reason: formValues?.reasons ?? [],
      };

      updates = getStatusChangeUpdatesFromFormValues<AlertStatusUpdateRequest>(
        updates,
        isNewFeaturesEnabled,
        props.user as TableUser,
        formValues,
      );

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
      advancedOptions={
        isNewFeaturesEnabled &&
        (statusEscalated(props.newStatus) || props.newStatus === 'CLOSED') &&
        props.entityIds.length === 1 && <CaseEscalateTriggerAdvancedOptionsForm user={props.user} />
      }
      initialValues={{
        tags: props.user?.tags ?? [],
        ...(props?.user?.type === 'CONSUMER' && {
          screeningDetails: {
            pepStatus: [
              {} as PEPStatus,
              ...(consolidatePEPStatus(props?.user?.pepStatus ?? []) as PEPStatus[]),
            ],
            sanctionsStatus:
              props?.user?.sanctionsStatus === undefined ? undefined : props?.user?.sanctionsStatus,
            adverseMediaStatus:
              props?.user?.adverseMediaStatus === undefined
                ? undefined
                : props?.user?.adverseMediaStatus,
          },
        }),
      }}
    />
  );
}
