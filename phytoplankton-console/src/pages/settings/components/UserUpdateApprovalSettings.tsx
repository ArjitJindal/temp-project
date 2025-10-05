import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SettingsCard from '@/components/library/SettingsCard';
import Select from '@/components/library/Select';
import { useHasResources, useRoles } from '@/utils/user-utils';
import {
  useFeatureEnabled,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getErrorMessage, neverReturn } from '@/utils/lang';
import Button from '@/components/library/Button';
import {
  CreateWorkflowType,
  TenantSettings,
  UserUpdateApprovalWorkflow,
  WorkflowSettingsUserApprovalWorkflows,
} from '@/apis';
import { formatRoleName } from '@/pages/accounts/utils';
import { useUserApprovalSettings } from '@/hooks/api/workflows';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  SETTINGS,
  USER_CHANGES_PROPOSALS,
  WORKFLOWS_ITEMS,
  WORKFLOWS_ITEMS_ALL,
} from '@/utils/queries/keys';
import { all, AsyncResource, getOr, isLoading, loading, map, success } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { InputProps } from '@/components/library/Form';
import Alert from '@/components/library/Alert';
import ArrowRightLineIcon from '@/components/ui/icons/Remix/system/arrow-right-line.react.svg';
import { notEmpty } from '@/utils/array';
import { useDeepEqualEffect } from '@/utils/hooks';

const MAX_ROLES_LIMIT = 3;

type TableDataRow = {
  field: keyof WorkflowSettingsUserApprovalWorkflows;
};

const columnHelper = new ColumnHelper<TableDataRow>();

const WORKFLOW_IDS: {
  [field in keyof WorkflowSettingsUserApprovalWorkflows]: string;
} = {
  Cra: '_default_Cra',
  CraLock: '_default_CraLock',
  eoddDate: '_default_eoddDate',
  PepStatus: '_default_PepStatus',
};

type Values = {
  [key in keyof WorkflowSettingsUserApprovalWorkflows]: string[];
};

export type UserWorkflowSettings = {
  [key in keyof WorkflowSettingsUserApprovalWorkflows]: UserUpdateApprovalWorkflow | null;
};

export const UserUpdateApprovalSettings: React.FC = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  const [state, setState] = useState<Values>({
    Cra: [],
    CraLock: [],
    eoddDate: [],
    PepStatus: [],
  });

  const [originalState, setOriginalState] = useState<Values>(state);

  // Fetch current workflows configuration
  const currentApprovalSettingsRes = useUserApprovalSettings();
  useDeepEqualEffect(() => {
    const data = getOr(currentApprovalSettingsRes, null);
    if (data) {
      const newState: Values = {
        Cra: data.Cra?.approvalChain ?? [],
        CraLock: data.CraLock?.approvalChain ?? [],
        eoddDate: data.eoddDate?.approvalChain ?? [],
        PepStatus: data.PepStatus?.approvalChain ?? [],
      };
      setState(newState);
      setOriginalState(newState);
    }
  }, [currentApprovalSettingsRes]);

  const mutateTenantSettings = useUpdateTenantSettings();

  // Check which fields have changed
  const changedFields = useMemo(() => {
    const changes: Array<keyof WorkflowSettingsUserApprovalWorkflows> = [];
    for (const field of Object.keys(state) as Array<keyof WorkflowSettingsUserApprovalWorkflows>) {
      const current = state[field];
      const original = originalState[field];

      // Ensure both arrays exist and are arrays
      if (!Array.isArray(current) || !Array.isArray(original)) {
        continue;
      }

      // Check if arrays have different lengths
      if (current.length !== original.length) {
        changes.push(field);
        continue;
      }

      // Check if any roles have changed (deep comparison)
      const hasChanges = current.some((role, index) => role !== original[index]);
      if (hasChanges) {
        changes.push(field);
      }
    }
    return changes;
  }, [state, originalState]);

  // Check if there are any changes to save
  const hasChanges = changedFields.length > 0;

  // Update workflow mutation - now only updates changed fields
  const updateWorkflowMutation = useMutation(
    async () => {
      const closeMessage = message.loading('Applying changes...');
      try {
        // Only update workflows for fields that have changed
        for (const field of changedFields) {
          const roles = state[field];
          const workflowId = WORKFLOW_IDS[field as keyof WorkflowSettingsUserApprovalWorkflows];

          if (roles && roles.length > 0 && workflowId) {
            const payload: CreateWorkflowType = {
              userUpdateApprovalWorkflow: {
                name: `User Update Approval - Reviewer Workflow - "${field}" field`,
                description:
                  'Single-step user approval workflow where a reviewer role can approve or reject user change proposals',
                enabled: true,
                approvalChain: roles as string[],
              },
            };
            await api.postWorkflowVersion({
              workflowType: 'user-update-approval',
              workflowId: workflowId,
              CreateWorkflowType: payload,
            });
          }
        }

        await mutateTenantSettings.mutateAsync({
          workflowSettings: {
            userApprovalWorkflows: {
              Cra: state['Cra']?.length ? WORKFLOW_IDS['Cra'] : undefined,
              CraLock: state['CraLock']?.length ? WORKFLOW_IDS['CraLock'] : undefined,
              eoddDate: state['eoddDate']?.length ? WORKFLOW_IDS['eoddDate'] : undefined,
              PepStatus: state['PepStatus']?.length ? WORKFLOW_IDS['PepStatus'] : undefined,
            },
          },
        });
        await queryClient.invalidateQueries(SETTINGS());
      } finally {
        closeMessage();
      }
    },
    {
      onSuccess: async () => {
        message.success('User approval roles updated successfully');
        await queryClient.invalidateQueries(WORKFLOWS_ITEMS_ALL('user-update-approval'));
        // Update original state after successful save
        setOriginalState(state);
        // Invalidate proposal since we change proposal when change role
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
      },
      onError: (error) => {
        message.error('Failed to update approval roles', {
          details: getErrorMessage(error),
        });
      },
    },
  );

  const validationError = useMemo(() => {
    // for (const [_, roles] of Object.entries(state)) {
    //   if (roles.length === 0) {
    //     return 'Every field should have at least one role in an approval chain';
    //   }
    // }
    return null;
  }, []);

  return (
    <SettingsCard
      title="User updates approval role"
      description="Configure the approval chain for every supported user attribute"
    >
      <AsyncResourceRenderer resource={currentApprovalSettingsRes}>
        {() => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Table<TableDataRow>
                  rowKey={'field'}
                  rowHeightMode={'AUTO'}
                  toolsOptions={false}
                  pagination={false}
                  data={{
                    items: [
                      { field: 'Cra' },
                      { field: 'CraLock' },
                      { field: 'eoddDate' },
                      { field: 'PepStatus' },
                    ],
                  }}
                  columns={[
                    columnHelper.display({
                      title: 'Field',
                      render: (item) => getFieldName(item.field),
                    }),
                    columnHelper.display({
                      title: 'Roles',
                      render: (item) => {
                        const isFieldChanged = changedFields.includes(item.field);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RoleList
                              value={state[item.field]}
                              onChange={(newValue) => {
                                setState((prev) => ({
                                  ...prev,
                                  [item.field]: newValue ?? [],
                                }));
                              }}
                            />
                            {isFieldChanged && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#666',
                                  fontStyle: 'italic',
                                }}
                              >
                                Modified
                              </div>
                            )}
                          </div>
                        );
                      },
                    }),
                  ]}
                />
              </div>
            </div>
            {validationError != null && <Alert type={'WARNING'}>{validationError}</Alert>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                type="PRIMARY"
                isDisabled={validationError != null || !hasChanges}
                isLoading={isLoading(updateWorkflowMutation.dataResource)}
                onClick={() => {
                  updateWorkflowMutation.mutate();
                }}
              >
                Save
              </Button>
              <Button
                type="SECONDARY"
                isDisabled={!hasChanges}
                isLoading={isLoading(updateWorkflowMutation.dataResource)}
                onClick={() => {
                  setState(originalState);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </AsyncResourceRenderer>
    </SettingsCard>
  );
};

/*
  Helpers
 */
function RoleList(props: InputProps<string[]>) {
  const { value, onChange } = props;

  const [roles, isLoadingRoles] = useRoles();
  const permissions = useHasResources(['write:::users/user-overview/*']);

  // Create role options from fetched roles
  const roleOptions = useMemo(() => {
    return roles.map((role) => ({
      label: formatRoleName(role.name), // Show formatted readable name
      value: role.name, // Send role name to backend
      isDisabled: value?.includes(role.name),
    }));
  }, [roles, value]);

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {value?.map((role, i) => {
        const isRoleMissing = !roleOptions.some((x) => x.value === role);
        return (
          <SelectWrapper key={`${role}-${i}`}>
            <Select
              mode="SINGLE"
              options={
                isRoleMissing
                  ? [
                      {
                        value: role,
                        label: `Unknown role: ${role}`,
                        isDisabled: true,
                      },
                      ...roleOptions,
                    ]
                  : roleOptions
              }
              value={role}
              isLoading={isLoadingRoles}
              isDisabled={!permissions || isLoadingRoles}
              isError={isRoleMissing}
              onChange={(newRole) => {
                if (newRole) {
                  onChange?.(value.map((x, index) => (index === i ? newRole : x)));
                } else {
                  onChange?.(value.filter((_, index) => index !== i));
                }
              }}
              placeholder="Select a role"
            />
            {i < MAX_ROLES_LIMIT - 1 && (
              <ArrowRightLineIcon style={{ width: '16px', color: '#666666' }} />
            )}
          </SelectWrapper>
        );
      })}
      {(value == null || value.length < MAX_ROLES_LIMIT) && (
        <SelectWrapper>
          <Select
            mode="SINGLE"
            options={roleOptions}
            isLoading={isLoadingRoles}
            isDisabled={!permissions || isLoadingRoles}
            onChange={(newRole) => {
              if (newRole) {
                onChange?.([...(value ?? []), newRole]);
              }
            }}
            placeholder="Select a role"
          />
        </SelectWrapper>
      )}
    </div>
  );
}

function SelectWrapper(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: '8px',
        alignItems: 'center',
        minWidth: '150px',
        maxWidth: '300px',
      }}
    >
      {props.children}
    </div>
  );
}

export function useUserApprovalSettings(): AsyncResource<UserWorkflowSettings> {
  const api = useApi();

  const { data: tenantSettingsRes } = useQuery(SETTINGS(), async (): Promise<TenantSettings> => {
    return await api.getTenantsSettings();
  });

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
    WORKFLOWS_ITEMS('user-update-approval', workflowIds),
    async (): Promise<UserUpdateApprovalWorkflow[]> => {
      return await Promise.all(
        workflowIds.map(async (workflowId) => {
          const workflow = await api.getWorkflowById({
            workflowType: 'user-update-approval',
            workflowId: workflowId,
          });
          return workflow as unknown as UserUpdateApprovalWorkflow;
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

function getFieldName(field: keyof WorkflowSettingsUserApprovalWorkflows): string {
  switch (field) {
    case 'Cra':
      return 'CRA';
    case 'CraLock':
      return 'CRA lock';
    case 'eoddDate':
      return 'EODD';
    case 'PepStatus':
      return 'PEP status';
  }
  return neverReturn(field, field);
}
