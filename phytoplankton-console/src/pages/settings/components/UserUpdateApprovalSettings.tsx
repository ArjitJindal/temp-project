import React, { useEffect, useMemo, useState } from 'react';
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
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { SETTINGS, WORKFLOWS_ITEMS, WORKFLOWS_ITEMS_ALL } from '@/utils/queries/keys';
import {
  all,
  AsyncResource,
  getOr,
  isLoading,
  loading,
  map,
  success,
  useFinishedSuccessfully,
} from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { InputProps } from '@/components/library/Form';
import Alert from '@/components/library/Alert';
import ArrowRightLineIcon from '@/components/ui/icons/Remix/system/arrow-right-line.react.svg';
import { notEmpty } from '@/utils/array';

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

  const [previousState, setPreviousState] = useState<Values>(state);

  // Fetch current workflows configuration
  const currentApprovalSettingsRes = useUserApprovalSettings();

  const isSettingsLoaded = useFinishedSuccessfully(currentApprovalSettingsRes);
  useEffect(() => {
    const data = getOr(currentApprovalSettingsRes, null);
    if (isSettingsLoaded && data) {
      const updater = (prev) => {
        const result = {};
        for (const [key, roles] of Object.entries(data)) {
          result[key] = roles?.approvalChain ?? prev[key];
        }
        return result;
      };
      setState(updater);
      setPreviousState(updater);
    }
  }, [currentApprovalSettingsRes, isSettingsLoaded]);

  const mutateTenantSettings = useUpdateTenantSettings();

  // Update workflow mutation
  const updateWorkflowMutation = useMutation(
    async () => {
      const closeMessage = message.loading('Applying changes...');
      try {
        for (const [field, roles] of Object.entries(state)) {
          if (roles.length > 0) {
            const payload: CreateWorkflowType = {
              userUpdateApprovalWorkflow: {
                name: `User Update Approval - Reviewer Workflow - "${field}" field`,
                description:
                  'Single-step user approval workflow where a reviewer role can approve or reject user change proposals',
                enabled: true,
                approvalChain: roles,
              },
            };
            await api.postWorkflowVersion({
              workflowType: 'user-update-approval',
              workflowId: WORKFLOW_IDS[field],
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
                        return (
                          <RoleList
                            value={state[item.field]}
                            onChange={(newValue) => {
                              setState((prev) => ({
                                ...prev,
                                [item.field]: newValue ?? [],
                              }));
                            }}
                          />
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
                isDisabled={validationError != null}
                isLoading={isLoading(updateWorkflowMutation.dataResource)}
                onClick={() => {
                  updateWorkflowMutation.mutate();
                }}
              >
                Save
              </Button>
              <Button
                type="SECONDARY"
                isLoading={isLoading(updateWorkflowMutation.dataResource)}
                onClick={() => {
                  setState(previousState);
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
      {value?.map((role, i) => (
        <SelectWrapper key={`${role}-${i}`}>
          <Select
            mode="SINGLE"
            options={roleOptions}
            value={role}
            isLoading={isLoadingRoles}
            isDisabled={!permissions || isLoadingRoles}
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
      ))}
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
