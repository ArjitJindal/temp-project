import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertWorkflow,
  AlertWorkflowWorkflowTypeEnum,
  ApiException,
  ApprovalWorkflow,
  ApprovalWorkflowWorkflowTypeEnum,
  CaseWorkflow,
  CaseWorkflowWorkflowTypeEnum,
  WorkflowRef,
  WorkflowSettingsUserApprovalWorkflows,
} from '@/apis';
import { useApi } from '@/api';
import { useQueries, useQuery } from '@/utils/queries/hooks';
import {
  WORKFLOWS_ITEM,
  WORKFLOWS_ITEM_BY_REF,
  WORKFLOWS_ITEMS,
  WORKFLOWS_ITEMS_ALL,
  WORKFLOWS_LIST,
} from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { all, AsyncResource, getOr, isLoading, loading, map, success } from '@/utils/asyncResource';
import { useSettingsData } from '@/utils/api/auth';
import { notEmpty } from '@/utils/array';
import { useCurrentUserRoleId } from '@/utils/role-utils';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { StatePair } from '@/utils/state';

export type CaseAlertWorkflowItem = CaseWorkflow | AlertWorkflow;

export type WorkflowItem = CaseAlertWorkflowItem | ApprovalWorkflow;

export type WorkflowType =
  | CaseWorkflowWorkflowTypeEnum
  | AlertWorkflowWorkflowTypeEnum
  | ApprovalWorkflowWorkflowTypeEnum;

export function parseWorkflowType(type: unknown): WorkflowType {
  if (type === 'alert') {
    return 'alert';
  } else if (type === 'case') {
    return 'case';
  } else if (type === 'change-approval') {
    return 'change-approval';
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
  workflowType: ApprovalWorkflowWorkflowTypeEnum,
  workflowRef: WorkflowRef,
): QueryResult<ApprovalWorkflow>;
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
        version: workflowRef.version,
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
  workflowType: ApprovalWorkflowWorkflowTypeEnum,
  id: string,
): QueryResult<ApprovalWorkflow | null>;
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
            version: workflowRef.version,
          });
        },
      };
    }),
  });
}

/*
  User approvals
 */

export function useUserFieldChangesStrategy(
  field: keyof WorkflowSettingsUserApprovalWorkflows,
): AsyncResource<WorkflowChangesStrategy> {
  const chainRes = useUserFieldChain(field);
  const currentUserRoleId = useCurrentUserRoleId();

  const isUserChangesApprovalEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  if (!isUserChangesApprovalEnabled) {
    return success('DIRECT' as const);
  }

  return map(chainRes, (chain) => {
    // If no approval chain is configured, apply changes directly
    if (chain.length === 0) {
      return 'DIRECT';
    }

    if (currentUserRoleId == null) {
      return 'APPROVE';
    }
    // Auto-approve would happen if chain's length is 1 and the role ID matches current user's role ID
    const isAutoApprove = chain.length === 1 && chain[0] === currentUserRoleId;
    return isAutoApprove ? 'AUTO_APPROVE' : 'APPROVE';
  });
}

export function useRiskLevelsChangesStrategy(): AsyncResource<WorkflowChangesStrategy> {
  // todo: fetch settings and use workflow from there
  const workflowRes = useWorkflowById('change-approval', '_default');
  const currentUserRoleId = useCurrentUserRoleId();

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  if (!isApprovalWorkflowsEnabled) {
    return success('DIRECT' as const);
  }

  return map(workflowRes.data, (workflow) => {
    if (currentUserRoleId == null) {
      return 'APPROVE';
    }
    const chain = workflow?.approvalChain ?? [];
    // Auto-approve would happen if chain's length is 1 and the role ID matches current user's role ID
    const isAutoApprove = chain.length === 1 && chain[0] === currentUserRoleId;
    return isAutoApprove ? 'AUTO_APPROVE' : 'APPROVE';
  });
}

export type UserWorkflowSettings = {
  [key in keyof WorkflowSettingsUserApprovalWorkflows]: ApprovalWorkflow | null;
};

export type RiskWorkflowSettings = {
  riskLevelsApprovalWorkflow: ApprovalWorkflow | null;
  riskFactorsApprovalWorkflow: ApprovalWorkflow | null;
};

export function useRiskApprovalSettings(): AsyncResource<RiskWorkflowSettings> {
  const api = useApi();

  const { data: tenantSettingsRes } = useSettingsData();

  const fieldsToWorkflowIdRes = map(
    tenantSettingsRes,
    (
      tenantSettings,
    ): {
      riskLevelsApprovalWorkflow: string | null;
      riskFactorsApprovalWorkflow: string | null;
    } => {
      return {
        riskLevelsApprovalWorkflow:
          tenantSettings.workflowSettings?.riskLevelsApprovalWorkflow ?? null,
        riskFactorsApprovalWorkflow:
          tenantSettings.workflowSettings?.riskFactorsApprovalWorkflow ?? null,
      };
    },
  );

  const workflowIdsRes = map(fieldsToWorkflowIdRes, (fieldToWorkflowIds): string[] =>
    Object.values(fieldToWorkflowIds).filter(notEmpty),
  );
  const workflowIds = getOr(workflowIdsRes, []);

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const { data: workflowsRes } = useQuery(
    WORKFLOWS_ITEMS('change-approval', workflowIds),
    async (): Promise<ApprovalWorkflow[]> => {
      return await Promise.all(
        workflowIds.map(async (workflowId) => {
          const workflow = await api.getWorkflowById({
            workflowType: 'change-approval',
            workflowId: workflowId,
          });
          return workflow as unknown as ApprovalWorkflow;
        }),
      );
    },
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );

  return useMemo((): AsyncResource<RiskWorkflowSettings> => {
    if (!isApprovalWorkflowsEnabled) {
      return success({
        riskLevelsApprovalWorkflow: null,
        riskFactorsApprovalWorkflow: null,
      });
    }
    if (isLoading(workflowIdsRes) || isLoading(workflowsRes)) {
      return loading();
    }
    return map(
      all([fieldsToWorkflowIdRes, workflowsRes]),
      ([fieldsToWorkflowId, workflows]): RiskWorkflowSettings => {
        const allWorkflows: RiskWorkflowSettings = {
          riskLevelsApprovalWorkflow: null,
          riskFactorsApprovalWorkflow: null,
        };
        for (const [field, workflowId] of Object.entries(fieldsToWorkflowId)) {
          if (workflowId != null) {
            const workflow = workflows.find((workflow) => workflow.id === workflowId);
            if (workflow == null) {
              throw new Error(`Workflow ${workflowId} not found`);
            }
            allWorkflows[field] = workflow;
          }
        }
        return allWorkflows;
      },
    );
  }, [workflowIdsRes, workflowsRes, isApprovalWorkflowsEnabled, fieldsToWorkflowIdRes]);
}

export function useRiskFactorsChangesStrategy(): AsyncResource<WorkflowChangesStrategy> {
  const riskApprovalSettings = useRiskApprovalSettings();
  const workflowRes = map(
    riskApprovalSettings,
    ({ riskFactorsApprovalWorkflow }) => riskFactorsApprovalWorkflow,
  );
  const currentUserRoleId = useCurrentUserRoleId();

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  if (!isApprovalWorkflowsEnabled) {
    return success('DIRECT' as const);
  }

  return map(workflowRes, (workflow) => {
    if (currentUserRoleId == null) {
      return 'APPROVE';
    }
    const chain = workflow?.approvalChain ?? [];
    // Auto-approve would happen if chain's length is 1 and the role ID matches current user's role ID
    const isAutoApprove = chain.length === 1 && chain[0] === currentUserRoleId;
    return isAutoApprove ? 'AUTO_APPROVE' : 'APPROVE';
  });
}

export function useUserApprovalSettings(): AsyncResource<UserWorkflowSettings> {
  const api = useApi();

  const { data: tenantSettingsRes } = useSettingsData();

  const fieldsToWorkflowIdRes = map(
    tenantSettingsRes,
    (tenantSettings): WorkflowSettingsUserApprovalWorkflows => {
      const userApprovalWorkflows = tenantSettings.workflowSettings?.userApprovalWorkflows;
      if (userApprovalWorkflows == null) {
        return {};
      }
      return userApprovalWorkflows;
    },
  );

  const workflowIdsRes = map(fieldsToWorkflowIdRes, (fieldToWorkflowIds): string[] =>
    Object.values(fieldToWorkflowIds).filter(notEmpty),
  );
  const workflowIds = getOr(workflowIdsRes, []);

  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');

  const { data: workflowsRes } = useQuery(
    WORKFLOWS_ITEMS('change-approval', workflowIds),
    async (): Promise<(ApprovalWorkflow | null)[]> => {
      return await Promise.all(
        workflowIds.map(async (workflowId) => {
          try {
            const workflow = await api.getWorkflowById({
              workflowType: 'change-approval',
              workflowId: workflowId,
            });
            return workflow as unknown as ApprovalWorkflow;
          } catch (error) {
            if (error instanceof ApiException && error.code === 404) {
              return null;
            }
            throw error;
          }
        }),
      );
    },
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );

  return useMemo(() => {
    if (!isApprovalWorkflowsEnabled) {
      return success({});
    }
    if (isLoading(workflowIdsRes) || isLoading(workflowsRes)) {
      return loading();
    }
    return map(
      all([fieldsToWorkflowIdRes, workflowsRes]),
      ([fieldsToWorkflowId, workflows]): UserWorkflowSettings => {
        const allWorkflows: UserWorkflowSettings = {};
        for (const [field, workflowId] of Object.entries(fieldsToWorkflowId)) {
          if (workflowId != null) {
            const workflow = workflows.find((workflow) => workflow?.id === workflowId);
            if (workflow == null) {
              console.warn(`Workflow ${workflowId} not found`);
              // throw new Error(`Workflow ${workflowId} not found`);
            }
            allWorkflows[field] = workflow;
          }
        }
        return allWorkflows;
      },
    );
  }, [workflowIdsRes, workflowsRes, isApprovalWorkflowsEnabled, fieldsToWorkflowIdRes]);
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
  const currentUserRoleId = useCurrentUserRoleId();

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
      } else if (
        approvalChain.length === 1 &&
        currentUserRoleId &&
        approvalChain[0] === currentUserRoleId
      ) {
        // Auto-approve: chain has one step and current user has that role ID
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
    currentUserRoleId,
    eoddChainRes,
    pepChainRes,
    craChainRes,
    craLockChainRes,
  ]);
}

export function useWorkflowListByType(
  workflowType: WorkflowType,
  includeDisabled = false,
): QueryResult<WorkflowItem[]> {
  const api = useApi();
  const workflowsQueryResult = useQuery(
    WORKFLOWS_ITEMS_ALL(workflowType),
    async (): Promise<WorkflowItem[]> => {
      let workflows = await api.getAllWorkflows({
        workflowType: workflowType,
      });
      if (!includeDisabled) {
        workflows = workflows.filter((x) => x.enabled);
      }
      return workflows;
    },
  );
  return workflowsQueryResult;
}

// todo: need to fix an API to make a single call
export function useAllWorkflowList(): QueryResult<WorkflowItem[]> {
  const api = useApi();
  return useQuery(WORKFLOWS_LIST({}), async (): Promise<WorkflowItem[]> => {
    const workflowResponses = await Promise.all(
      [
        'case',
        'alert',
        'change-approval', // Unified approval workflow type
      ].map((workflowType) =>
        api.getAllWorkflows({
          workflowType: workflowType,
        }),
      ),
    );
    return workflowResponses.flatMap((x) => x) ?? [];
  });
}

export function useChangeWorkflowEnableMutation(currentStatePair: StatePair<boolean | undefined>) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [value, setValue] = currentStatePair;
  return useMutation<
    unknown,
    unknown,
    {
      workflowType: WorkflowType;
      workflowId: string;
      enabled: boolean;
    },
    {
      previousValue: boolean | undefined;
    }
  >(
    async (variables) => {
      return await api.patchWorkflowEnabled({
        workflowId: variables.workflowId,
        workflowType: variables.workflowType,
        UpdateWorkflowEnabledRequest: {
          enabled: variables.enabled,
        },
      });
    },
    {
      onMutate: () => {
        return { previousValue: value };
      },
      onSuccess: async (result, variables) => {
        message.success(
          `Workflow ${variables.workflowId} ${variables.enabled ? 'enabled' : 'disabled'}`,
        );
        // todo: instead just update cached data, also need to refactor cache structure
        await queryClient.invalidateQueries(WORKFLOWS_LIST({}));
        await queryClient.invalidateQueries(WORKFLOWS_ITEMS_ALL(variables.workflowType));
        await queryClient.invalidateQueries(
          WORKFLOWS_ITEM(variables.workflowType, variables.workflowId),
        );
        await queryClient.invalidateQueries(
          WORKFLOWS_ITEMS(variables.workflowType, [variables.workflowId]),
        );
      },
      onError: (e, variables, context) => {
        message.fatal(`Unable to update workflow`, e);
        if (context) {
          setValue(context?.previousValue);
        }
      },
    },
  );
}
