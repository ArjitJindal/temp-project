import {
  AlertWorkflow,
  AlertWorkflowWorkflowTypeEnum,
  CaseWorkflow,
  CaseWorkflowWorkflowTypeEnum,
  RiskLevelApprovalWorkflow,
  RiskLevelApprovalWorkflowWorkflowTypeEnum,
  RuleApprovalWorkflow,
  RuleApprovalWorkflowWorkflowTypeEnum,
  WorkflowRef,
} from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { WORKFLOWS_ITEM_BY_REF } from '@/utils/queries/keys';

export type CaseAlertWorkflowItem = CaseWorkflow | AlertWorkflow;

export type WorkflowItem = CaseAlertWorkflowItem | RiskLevelApprovalWorkflow | RuleApprovalWorkflow;

export type WorkflowType =
  | CaseWorkflowWorkflowTypeEnum
  | AlertWorkflowWorkflowTypeEnum
  | RiskLevelApprovalWorkflowWorkflowTypeEnum
  | RuleApprovalWorkflowWorkflowTypeEnum;

export function parseWorkflowType(type: unknown): WorkflowType {
  if (type === 'alert') {
    return 'alert';
  } else if (type === 'case') {
    return 'case';
  } else {
    throw new Error(`Invalid workflow type ${type}`);
  }
}

/*
    Helpers
*/
export function useWorkflow(workflowType: string, workflowRef?: WorkflowRef) {
  const api = useApi();
  const workflowsQueryResult = useQuery(
    WORKFLOWS_ITEM_BY_REF(workflowRef),
    async (): Promise<WorkflowItem> => {
      if (workflowRef == null || workflowRef.id == null || workflowRef.version == null) {
        throw new Error('Workflow ref is required');
      }
      return await api.getWorkflowVersion({
        workflowType,
        workflowId: workflowRef.id,
        version: workflowRef.version.toString(),
      });
    },
  );

  return workflowsQueryResult;
}
