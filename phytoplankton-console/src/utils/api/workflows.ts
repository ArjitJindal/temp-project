import { useMemo } from 'react';
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
import { useApi } from '@/api';
import { useQueries, useQuery } from '@/utils/queries/hooks';
import {
  USER_CHANGES_PROPOSALS_BY_ID,
  USER_FIELDS_CHANGES_PROPOSALS,
  WORKFLOWS_ITEM,
  WORKFLOWS_ITEM_BY_REF,
} from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { AsyncResource, getOr, map, success } from '@/utils/asyncResource';
import { useUserApprovalSettings } from '@/pages/settings/components/UserUpdateApprovalSettings';
import { useAccountRawRole } from '@/utils/user-utils';

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
  'DIRECT' - changes should be made directly, through classic API
  'APPROVE' - changes should be send via Approval-API
  'AUTO_APPROVE' - user changes will be approved automatically, but need to be send via Approval-API
 */
export type WorkflowChangesStrategy = 'DIRECT' | 'AUTO_APPROVE' | 'APPROVE';

/*
    Helpers
*/
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

/*
  Retrieves latest version by id
 */
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
    // If no approval chain is configured, apply changes directly
    if (chain.length === 0) {
      return 'DIRECT';
    }

    if (currentRole == null) {
      return 'APPROVE';
    }
    // Auto-approve would happen if chain's length is 1 and the role matches current role
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
    // Auto-approve would happen if chain's length is 1 and the role matches current role
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
    // Auto-approve would happen if chain's length is 1 and the role matches current role
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

export interface DispositionFieldApprovalInfo {
  field: keyof WorkflowSettingsUserApprovalWorkflows;
  fieldDisplayName: string;
  requiresApproval: boolean;
  isAutoApprove: boolean;
  approvalChain: string[];
}

export interface DispositionApprovalWarnings {
  hasFieldsRequiringApproval: boolean;
  hasFieldsWithAutoApproval: boolean;
  fieldsInfo: DispositionFieldApprovalInfo[];
  approvalFields: DispositionFieldApprovalInfo[];
  autoApprovalFields: DispositionFieldApprovalInfo[];
  directFields: DispositionFieldApprovalInfo[];
}

/**
 * Hook to check which disposition fields require approval workflows
 * and provide warnings for the UI
 */
export function useDispositionApprovalWarnings(): DispositionApprovalWarnings {
  const isUserChangesApprovalEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  const currentRole = useAccountRawRole();

  // Get approval chains for all supported fields
  const eoddChainRes = useUserFieldChain('eoddDate');
  const pepChainRes = useUserFieldChain('PepStatus');
  const craChainRes = useUserFieldChain('Cra');
  const craLockChainRes = useUserFieldChain('CraLock');

  return useMemo(() => {
    if (!isUserChangesApprovalEnabled) {
      // Feature disabled - no approvals needed
      return {
        hasFieldsRequiringApproval: false,
        hasFieldsWithAutoApproval: false,
        fieldsInfo: [],
        approvalFields: [],
        autoApprovalFields: [],
        directFields: [],
      };
    }

    const fieldsInfo: DispositionFieldApprovalInfo[] = [
      {
        field: 'eoddDate',
        fieldDisplayName: 'EODD Date',
        requiresApproval: false,
        isAutoApprove: false,
        approvalChain: getOr(eoddChainRes, []),
      },
      {
        field: 'PepStatus',
        fieldDisplayName: 'PEP/Sanctions/Adverse Media Status',
        requiresApproval: false,
        isAutoApprove: false,
        approvalChain: getOr(pepChainRes, []),
      },
      {
        field: 'Cra',
        fieldDisplayName: 'CRA Status',
        requiresApproval: false,
        isAutoApprove: false,
        approvalChain: getOr(craChainRes, []),
      },
      {
        field: 'CraLock',
        fieldDisplayName: 'CRA Lock',
        requiresApproval: false,
        isAutoApprove: false,
        approvalChain: getOr(craLockChainRes, []),
      },
    ];

    // Update requiresApproval and isAutoApprove based on approval chains
    fieldsInfo.forEach((fieldInfo) => {
      const { approvalChain } = fieldInfo;

      if (approvalChain.length === 0) {
        // No approval chain configured
        fieldInfo.requiresApproval = false;
        fieldInfo.isAutoApprove = false;
      } else if (approvalChain.length === 1 && currentRole && approvalChain[0] === currentRole) {
        // Auto-approve: chain has one step and current user has that role
        fieldInfo.requiresApproval = false;
        fieldInfo.isAutoApprove = true;
      } else {
        // Requires approval
        fieldInfo.requiresApproval = true;
        fieldInfo.isAutoApprove = false;
      }
    });

    const approvalFields = fieldsInfo.filter((f) => f.requiresApproval);
    const autoApprovalFields = fieldsInfo.filter((f) => f.isAutoApprove);
    const directFields = fieldsInfo.filter((f) => !f.requiresApproval && !f.isAutoApprove);

    return {
      hasFieldsRequiringApproval: approvalFields.length > 0,
      hasFieldsWithAutoApproval: autoApprovalFields.length > 0,
      fieldsInfo,
      approvalFields,
      autoApprovalFields,
      directFields,
    };
  }, [
    isUserChangesApprovalEnabled,
    currentRole,
    eoddChainRes,
    pepChainRes,
    craChainRes,
    craLockChainRes,
  ]);
}
