import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { RiskFactorsApprovalRequestActionEnum } from '@/apis';
import { useApi } from '@/api';
import type { Mutation } from '@/utils/queries/types';
import { RISK_FACTOR_WORKFLOW_PROPOSAL } from '@/utils/queries/keys';

// todo: generalise with risk-levels proposals
export function useSendProposalActionMutation(
  onSuccess?: (action: RiskFactorsApprovalRequestActionEnum) => void,
): Mutation<
  unknown,
  unknown,
  {
    riskFactorId: string;
    action: RiskFactorsApprovalRequestActionEnum;
  }
> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    unknown,
    {
      riskFactorId: string;
      action: RiskFactorsApprovalRequestActionEnum;
    }
  >(
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
        await api.postPulseRiskFactorsWorkflowAction({
          RiskFactorsApprovalRequest: {
            riskFactorId: vars.riskFactorId,
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
          message.success('Proposal cancelled!');
        }
        if (variables.action === 'accept') {
          message.success('Proposal accepted!');
        }
        if (variables.action === 'reject') {
          message.success('Proposal rejected!');
        }
        await queryClient.invalidateQueries(RISK_FACTOR_WORKFLOW_PROPOSAL());
        onSuccess?.(variables.action);
      },
      onError: (e) => {
        message.fatal('Unable to apply action', e);
      },
    },
  );
}
