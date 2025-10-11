import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import {
  RISK_CLASSIFICATION_VALUES,
  RISK_CLASSIFICATION_WORKFLOW_PROPOSAL,
} from '@/utils/queries/keys';
import { RiskClassificationApprovalRequestActionEnum } from '@/apis';
import { useApi } from '@/api';
import type { Mutation } from '@/utils/queries/types';

export function useSendProposalActionMutation(): Mutation<
  unknown,
  unknown,
  { action: RiskClassificationApprovalRequestActionEnum }
> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, { action: RiskClassificationApprovalRequestActionEnum }>(
    async (vars) => {
      let messageText = 'Applying changes...';
      if (vars.action === 'cancel') {
        messageText = 'Cancelling proposal...';
      }
      if (vars.action === 'accept') {
        messageText = 'Accepting proposal...';
      }
      if (vars.action === 'reject') {
        messageText = 'Rejecting proposal...';
      }
      const hideMessage = message.loading(messageText);
      try {
        await api.postPulseRiskClassificationWorkflowAction({
          RiskClassificationApprovalRequest: {
            action: vars.action,
          },
        });
      } finally {
        hideMessage();
      }
    },
    {
      onSuccess: async (_, variables) => {
        if (variables.action === 'cancel') {
          message.success('Risk levels proposal cancelled!');
        }
        if (variables.action === 'accept') {
          message.success('Risk levels proposal accepted!');
        }
        if (variables.action === 'reject') {
          message.success('Risk levels proposal rejected!');
        }
        await queryClient.invalidateQueries(RISK_CLASSIFICATION_VALUES());
        await queryClient.invalidateQueries(RISK_CLASSIFICATION_WORKFLOW_PROPOSAL());
      },
      onError: (e) => {
        message.fatal('Unable to apply action', e);
      },
    },
  );
}
