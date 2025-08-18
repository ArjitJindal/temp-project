import { useMemo } from 'react';
import {
  AlertWorkflow,
  AlertWorkflowWorkflowTypeEnum,
  CaseWorkflow,
  CaseWorkflowWorkflowTypeEnum,
  RiskLevelApprovalWorkflow,
  RiskLevelApprovalWorkflowWorkflowTypeEnum,
  RuleApprovalWorkflow,
  RuleApprovalWorkflowWorkflowTypeEnum,
  UserApproval,
  UserUpdateApprovalWorkflow,
  UserUpdateApprovalWorkflowWorkflowTypeEnum,
  WorkflowRef,
  WorkflowSettingsUserApprovalWorkflows,
  RiskFactorsApprovalWorkflow,
  RiskFactorsApprovalWorkflowWorkflowTypeEnum,
} from '@/apis';
import { useApi } from '@/api';
import { useQueries, useQuery } from '@/utils/queries/hooks';
import {
  USER_CHANGES_PROPOSALS_BY_ID,
  USER_FIELDS_CHANGES_PROPOSALS,
  WORKFLOWS_ITEM_BY_REF,
} from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { AsyncResource, map, success } from '@/utils/asyncResource';
import { useUserApprovalSettings } from '@/pages/settings/components/UserUpdateApprovalSettings';

export type CaseAlertWorkflowItem = CaseWorkflow | AlertWorkflow;

export type WorkflowItem =
  | CaseAlertWorkflowItem
  | RiskLevelApprovalWorkflow
  | RiskFactorsApprovalWorkflow
  | UserUpdateApprovalWorkflow
  | RuleApprovalWorkflow;

export type WorkflowType =
  | CaseWorkflowWorkflowTypeEnum
  | AlertWorkflowWorkflowTypeEnum
  | RiskLevelApprovalWorkflowWorkflowTypeEnum
  | RuleApprovalWorkflowWorkflowTypeEnum
  | UserUpdateApprovalWorkflowWorkflowTypeEnum
  | RiskFactorsApprovalWorkflowWorkflowTypeEnum;

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
export function useWorkflow(
  workflowType: RiskLevelApprovalWorkflowWorkflowTypeEnum,
  workflowRef?: WorkflowRef,
): QueryResult<RiskLevelApprovalWorkflow>;
export function useWorkflow(
  workflowType: RiskFactorsApprovalWorkflowWorkflowTypeEnum,
  workflowRef?: WorkflowRef,
): QueryResult<RiskFactorsApprovalWorkflow>;
export function useWorkflow(workflowType: WorkflowType, workflowRef?: WorkflowRef) {
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

export function useWorkflows(
  workflowType: WorkflowType,
  workflowRefs: WorkflowRef[],
): QueryResult<WorkflowItem>[] {
  const api = useApi();
  return useQueries<WorkflowItem>({
    queries: workflowRefs.map((workflowRef) => {
      if (workflowRef == null || workflowRef.id == null || workflowRef.version == null) {
        throw new Error('Workflow ref is required');
      }
      return {
        queryKey: WORKFLOWS_ITEM_BY_REF(workflowRef),
        queryFn: async (): Promise<WorkflowItem> => {
          return await api.getWorkflowVersion({
            workflowType,
            workflowId: workflowRef.id,
            version: workflowRef.version.toString(),
          });
        },
      };
    }),
  });
}

/*
  User approvals
 */
export function useUserChangesPendingApprovals(userId: string): QueryResult<UserApproval[]> {
  const api = useApi();
  return useQuery(USER_CHANGES_PROPOSALS_BY_ID(userId), async () => {
    return await api.getUserApprovalProposals({
      userId,
    });
  });
}

export function useUserFieldChangesPendingApprovals(
  userId: string,
  fields: (keyof WorkflowSettingsUserApprovalWorkflows)[],
): AsyncResource<UserApproval[]> {
  const api = useApi();
  const isUserChangesApprovalEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  const result = useQuery(
    USER_FIELDS_CHANGES_PROPOSALS(
      userId,
      fields.map((x) => `${x}`),
    ),
    async () => {
      const approvals = await api.getUserApprovalProposals({
        userId,
      });
      return approvals.filter((approval) =>
        approval.proposedChanges.some((change) =>
          fields.includes(change.field as keyof WorkflowSettingsUserApprovalWorkflows),
        ),
      );
    },
    {
      enabled: isUserChangesApprovalEnabled,
    },
  );
  if (!isUserChangesApprovalEnabled) {
    return success([]);
  }
  return result.data;
}

export function useUserFieldChainDefined(
  field: keyof WorkflowSettingsUserApprovalWorkflows,
): AsyncResource<boolean> {
  const approvalSettingsRes = useUserApprovalSettings();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  return useMemo(
    () =>
      map(approvalSettingsRes, (approvalSettings) => {
        if (!isApprovalWorkflowsEnabled) {
          return false;
        }
        return approvalSettings[field] != null;
      }),
    [approvalSettingsRes, isApprovalWorkflowsEnabled, field],
  );
}
