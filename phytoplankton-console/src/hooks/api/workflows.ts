import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import {
  RISK_CLASSIFICATION_WORKFLOW_PROPOSAL,
  WORKFLOWS_ITEM,
  WORKFLOWS_LIST,
} from '@/utils/queries/keys';
import { WorkflowItem } from '@/utils/api/workflows';

export function useRiskClassificationWorkflowProposal(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(
    RISK_CLASSIFICATION_WORKFLOW_PROPOSAL(),
    async () => api.getPulseRiskClassificationWorkflowProposal(),
    { enabled: options?.enabled },
  );
}

export function useWorkflowsList() {
  const api = useApi();
  return useQuery(WORKFLOWS_LIST(), async (): Promise<WorkflowItem[]> => {
    const workflowResponse = await api.getAllWorkflowTypes();
    return workflowResponse.workflows ?? [];
  });
}

export function useWorkflowItem(workflowType: string, id: string) {
  const api = useApi();
  return useQuery(WORKFLOWS_ITEM(workflowType as any, id), async (): Promise<WorkflowItem> => {
    return await api.getWorkflowById({
      workflowType: workflowType as any,
      workflowId: id,
    });
  });
}
