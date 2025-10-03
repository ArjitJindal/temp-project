import { useMemo } from 'react';
import { useApi } from '@/api';
import { useQueries, useQuery } from '@/utils/queries/hooks';
import {
  RISK_CLASSIFICATION_WORKFLOW_PROPOSAL,
  WORKFLOWS_ITEM,
  WORKFLOWS_LIST,
  WORKFLOWS_ITEM_BY_REF,
  USER_CHANGES_PROPOSALS_BY_ID,
  USER_FIELDS_CHANGES_PROPOSALS,
} from '@/utils/queries/keys';
import {
  AlertWorkflow,
  AlertWorkflowWorkflowTypeEnum,
  ApiException,
  CaseWorkflow,
  CaseWorkflowWorkflowTypeEnum,
  RiskFactorsApprovalWorkflow,
  RiskFactorsApprovalWorkflowWorkflowTypeEnum,
  RiskLevelApprovalWorkflow,
  RiskLevelApprovalWorkflowWorkflowTypeEnum,
  RuleApprovalWorkflow,
  RuleApprovalWorkflowWorkflowTypeEnum,
  UserApproval,
  UserUpdateApprovalWorkflow,
  UserUpdateApprovalWorkflowWorkflowTypeEnum,
  WorkflowRef,
  WorkflowSettingsUserApprovalWorkflows,
} from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { AsyncResource, map, success } from '@/utils/asyncResource';
import { useUserApprovalSettings } from '@/pages/settings/components/UserUpdateApprovalSettings';
import { useAccountRawRole } from '@/utils/user-utils';
import { useMutation } from '@/utils/queries/mutations/hooks';

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

export type WorkflowChangesStrategy = 'DIRECT' | 'AUTO_APPROVE' | 'APPROVE';

export function useWorkflow(
  workflowType: RiskLevelApprovalWorkflowWorkflowTypeEnum,
  workflowRef: WorkflowRef,
): QueryResult<RiskLevelApprovalWorkflow>;
export function useWorkflow(
  workflowType: RiskFactorsApprovalWorkflowWorkflowTypeEnum,
  workflowRef: WorkflowRef,
): QueryResult<RiskFactorsApprovalWorkflow>;
export function useWorkflow(workflowType: WorkflowType, workflowRef: WorkflowRef) {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
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
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );

  if (!isApprovalWorkflowsEnabled) {
    throw new Error('Approval workflows are not enabled');
  }

  return workflowsQueryResult;
}

export function useWorkflowById(
  workflowType: RiskLevelApprovalWorkflowWorkflowTypeEnum,
  id: string,
): QueryResult<RiskLevelApprovalWorkflow | null>;
export function useWorkflowById(
  workflowType: RiskFactorsApprovalWorkflowWorkflowTypeEnum,
  id: string,
): QueryResult<RiskFactorsApprovalWorkflow | null>;
export function useWorkflowById(
  workflowType: WorkflowType,
  id: string,
): QueryResult<WorkflowItem | null> {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const workflowsQueryResult = useQuery(
    WORKFLOWS_ITEM(workflowType, id),
    async (): Promise<WorkflowItem | null> => {
      try {
        const workflow = await api.getWorkflowById({
          workflowType: workflowType,
          workflowId: id,
        });
        return workflow;
      } catch (error) {
        if (error instanceof ApiException && error.code === 404) {
          return null;
        }
        throw error;
      }
    },
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );

  return isApprovalWorkflowsEnabled
    ? workflowsQueryResult
    : {
        data: success(null),
        refetch: () => {},
      };
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

export function useUserFieldChangesStrategy(
  field: keyof WorkflowSettingsUserApprovalWorkflows,
): AsyncResource<WorkflowChangesStrategy> {
  const chainRes = useUserFieldChain(field);
  const currentRole = useAccountRawRole();

  const isUserChangesApprovalEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  if (!isUserChangesApprovalEnabled) {
    return success('DIRECT' as const);
  }

  return map(chainRes, (chain) => {
    if (chain.length === 0) {
      return 'DIRECT';
    }

    if (currentRole == null) {
      return 'APPROVE';
    }
    const isAutoApprove = chain.length === 1 && chain[0] === currentRole;
    return isAutoApprove ? 'AUTO_APPROVE' : 'APPROVE';
  });
}

export function useRiskLevelsChangesStrategy(): AsyncResource<WorkflowChangesStrategy> {
  const workflowRes = useWorkflowById('risk-levels-approval', '_default');
  const currentRole = useAccountRawRole();

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  if (!isApprovalWorkflowsEnabled) {
    return success('DIRECT' as const);
  }

  return map(workflowRes.data, (workflow) => {
    if (currentRole == null) {
      return 'APPROVE';
    }
    const chain = workflow?.approvalChain ?? [];
    const isAutoApprove = chain.length === 1 && chain[0] === currentRole;
    return isAutoApprove ? 'AUTO_APPROVE' : 'APPROVE';
  });
}

export function useRiskFactorsChangesStrategy(): AsyncResource<WorkflowChangesStrategy> {
  const workflowRes = useWorkflowById('risk-factors-approval', '_default');
  const currentRole = useAccountRawRole();

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  if (!isApprovalWorkflowsEnabled) {
    return success('DIRECT' as const);
  }

  return map(workflowRes.data, (workflow) => {
    if (currentRole == null) {
      return 'APPROVE';
    }
    const chain = workflow?.approvalChain ?? [];
    const isAutoApprove = chain.length === 1 && chain[0] === currentRole;
    return isAutoApprove ? 'AUTO_APPROVE' : 'APPROVE';
  });
}

export function useUserFieldChain(
  field: keyof WorkflowSettingsUserApprovalWorkflows,
): AsyncResource<string[]> {
  const approvalSettingsRes = useUserApprovalSettings();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  return useMemo(
    () =>
      map(approvalSettingsRes, (approvalSettings): string[] => {
        if (!isApprovalWorkflowsEnabled) {
          return [];
        }
        return approvalSettings[field]?.approvalChain ?? [];
      }),
    [approvalSettingsRes, isApprovalWorkflowsEnabled, field],
  );
}

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

export function useCreateWorkflow(workflowType: WorkflowType) {
  const api = useApi();
  return useMutation((serialized: any) =>
    api.createWorkflow({
      workflowType,
      CreateWorkflowType:
        workflowType === 'alert'
          ? {
              alertWorkflow: {
                ...serialized,
                name: 'not_required_for_creation',
                description: 'not_required_for_creation',
                enabled: true,
              },
            }
          : {
              caseWorkflow: {
                ...serialized,
                name: 'not_required_for_creation',
                description: 'not_required_for_creation',
                enabled: true,
                autoClose: false,
              },
            },
    }),
  );
}

export function useCreateWorkflowVersion(workflowType: WorkflowType, workflowId: string) {
  const api = useApi();
  return useMutation((payload: { item: any; serialized: any }) =>
    api.postWorkflowVersion({
      workflowType,
      workflowId,
      CreateWorkflowType:
        payload.item.workflowType === 'alert'
          ? { alertWorkflow: { ...payload.item, ...payload.serialized } }
          : { caseWorkflow: { ...payload.item, ...payload.serialized } },
    }),
  );
}
