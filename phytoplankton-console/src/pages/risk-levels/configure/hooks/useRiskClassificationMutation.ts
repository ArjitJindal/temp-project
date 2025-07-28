import { useMutation, useQueryClient } from '@tanstack/react-query';
import { State, prepareApiState } from '../RiskClassificationTable';
import { useApi } from '@/api';
import { RiskClassificationConfigApproval, RiskClassificationHistory } from '@/apis';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  RISK_CLASSIFICATION_VALUES,
  RISK_CLASSIFICATION_WORKFLOW_PROPOSAL,
} from '@/utils/queries/keys';

interface UseRiskClassificationMutationProps {
  successAction?: () => void;
}

export function useRiskClassificationMutation(params?: UseRiskClassificationMutationProps) {
  const { successAction } = params ?? {};
  const api = useApi();

  const isApprovalWorkflowActive = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const queryClient = useQueryClient();

  const mutation = useMutation<
    RiskClassificationHistory | RiskClassificationConfigApproval,
    Error,
    { state: State; comment: string }
  >(
    async (data) => {
      if (isApprovalWorkflowActive) {
        return await api.postPulseRiskClassificationWorkflowProposal({
          RiskClassificationRequest: {
            scores: prepareApiState(data.state),
            comment: data.comment,
          },
        });
      }
      return api.postPulseRiskClassification({
        RiskClassificationRequest: {
          scores: prepareApiState(data.state),
          comment: data.comment,
        },
      });
    },
    {
      onSuccess: async () => {
        if (isApprovalWorkflowActive) {
          message.success('Proposal for risk classification levels submitted successfully!');
          await queryClient.invalidateQueries(RISK_CLASSIFICATION_WORKFLOW_PROPOSAL());
        } else {
          await queryClient.invalidateQueries(RISK_CLASSIFICATION_VALUES());
          message.success('Risk values saved successfully');
        }
        successAction?.();
      },
      onError: (error) => {
        if (isApprovalWorkflowActive) {
          message.fatal('Unable to send proposal for risk classification levels', error);
        } else {
          message.fatal('Unable to save risk values', error);
        }
      },
    },
  );

  return {
    isLoading: mutation.isLoading,
    mutate: mutation.mutate,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
  };
}
