import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SettingsCard from '@/components/library/SettingsCard';
import Select from '@/components/library/Select';
import { useUpdateTenantSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { message } from '@/components/library/Message';
import { getErrorMessage, neverReturn } from '@/utils/lang';
import Button from '@/components/library/Button';
import { WorkflowSettingsUserApprovalWorkflows } from '@/apis';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { SETTINGS, USER_CHANGES_PROPOSALS, WORKFLOWS_ITEMS_ALL } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Alert from '@/components/library/Alert';
import { useDeepEqualEffect } from '@/utils/hooks';
import { useUserApprovalSettings, useWorkflowListByType } from '@/utils/api/workflows';

type TableDataRow = {
  field: keyof WorkflowSettingsUserApprovalWorkflows;
};

const columnHelper = new ColumnHelper<TableDataRow>();

type Values = {
  [key in keyof WorkflowSettingsUserApprovalWorkflows]: string | null;
};

export const UserUpdateApprovalSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const [state, setState] = useState<Values>({
    Cra: null,
    CraLock: null,
    eoddDate: null,
    PepStatus: null,
  });

  const [originalState, setOriginalState] = useState<Values>(state);

  // Fetch current workflows configuration
  const currentApprovalSettingsRes = useUserApprovalSettings();
  useDeepEqualEffect(() => {
    const data = getOr(currentApprovalSettingsRes, null);
    if (data) {
      const newState: Values = {
        Cra: data.Cra?.id ?? null,
        CraLock: data.CraLock?.id ?? null,
        eoddDate: data.eoddDate?.id ?? null,
        PepStatus: data.PepStatus?.id ?? null,
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

      // Check if any roles have changed (deep comparison)
      const hasChanges = current != original;
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
        await mutateTenantSettings.mutateAsync({
          workflowSettings: {
            userApprovalWorkflows: {
              Cra: state['Cra'] as string | undefined,
              CraLock: state['CraLock'] as string | undefined,
              eoddDate: state['eoddDate'] as string | undefined,
              PepStatus: state['PepStatus'] as string | undefined,
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
        await queryClient.invalidateQueries(WORKFLOWS_ITEMS_ALL('change-approval'));
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

  const workflowsQueryResult = useWorkflowListByType('change-approval');

  return (
    <SettingsCard
      title="User updates approval workflow"
      description="Configure the approval workflow for every supported user attribute"
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
                      title: 'Workflow',
                      render: (item) => {
                        const isFieldChanged = changedFields.includes(item.field);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Select
                              isLoading={isLoading(workflowsQueryResult.data)}
                              value={state[item.field]}
                              options={getOr(workflowsQueryResult.data, []).map((workflow) => ({
                                label: workflow.id + ': ' + workflow.name,
                                value: workflow.id,
                              }))}
                              onChange={(newValue) => {
                                setState((prev) => ({
                                  ...prev,
                                  [item.field]: newValue ?? null,
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
