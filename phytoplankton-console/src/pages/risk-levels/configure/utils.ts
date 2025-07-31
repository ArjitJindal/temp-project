import { RISK_CLASSIFICATION_WORKFLOW_PROPOSAL } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import { RiskClassificationConfigApproval } from '@/apis';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export const usePendingProposal = () => {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const pendingProposalRes = useQuery<RiskClassificationConfigApproval>(
    RISK_CLASSIFICATION_WORKFLOW_PROPOSAL(),
    async () => {
      return await api.getPulseRiskClassificationWorkflowProposal();
    },
    { enabled: isApprovalWorkflowsEnabled },
  );

  return pendingProposalRes;
};
