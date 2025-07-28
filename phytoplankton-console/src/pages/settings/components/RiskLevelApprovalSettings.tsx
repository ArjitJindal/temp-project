import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SettingsCard from '@/components/library/SettingsCard';
import Select from '@/components/library/Select';
import { useHasResources, useRoles } from '@/utils/user-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import Button from '@/components/library/Button';
import { ApiException, RiskLevelApprovalWorkflow } from '@/apis';
import { formatRoleName } from '@/pages/accounts/utils';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { WORKFLOWS_ITEM } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

export const RiskLevelApprovalSettings: React.FC = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const permissions = useHasResources(['write:::settings/risk-scoring/risk-levels-approval/*']);
  const [roles, isLoadingRoles] = useRoles();

  const [selectedRole, setSelectedRole] = useState<string>();

  // Create role options from fetched roles
  const roleOptions = useMemo(() => {
    return roles.map((role) => ({
      label: formatRoleName(role.name), // Show formatted readable name
      value: role.name, // Send role name to backend
    }));
  }, [roles]);

  // Fetch current workflow configuration
  // { data: currentWorkflow, isLoading: isLoadingWorkflow }
  const currentWorkflowQueryResult = useQuery(
    WORKFLOWS_ITEM('risk-levels-approval', '_default'),
    async (): Promise<RiskLevelApprovalWorkflow | null> => {
      try {
        const workflow = await api.getWorkflowById({
          workflowType: 'risk-levels-approval',
          workflowId: '_default',
        });
        // setFetchError(null);
        return workflow as RiskLevelApprovalWorkflow;
      } catch (error) {
        if (error instanceof ApiException && error.code === 404) {
          return null;
        }
        throw error;
      }
    },
    {
      enabled: isApprovalWorkflowsEnabled,
      onSuccess: (data) => {
        if (data != null && data.approvalChain.length > 0) {
          setSelectedRole(data.approvalChain[0]);
        }
      },
    },
  );

  const currentWorkflow = getOr(currentWorkflowQueryResult.data, null);

  // Update workflow mutation
  const updateWorkflowMutation = useMutation<unknown, unknown, { role: string }>(
    async ({ role }) => {
      const closeMessage = message.loading('Applying changes...');
      try {
        const payload = {
          riskLevelApprovalWorkflow: {
            name: 'Rule Approval - Reviewer Workflow',
            description:
              'Single-step rule approval workflow where a reviewer role can approve or reject rule change proposals',
            enabled: true,
            approvalChain: [role],
          },
        };

        return await api.postWorkflowVersion({
          workflowType: 'risk-levels-approval',
          workflowId: '_default',
          CreateWorkflowType: payload,
        });
      } finally {
        closeMessage();
      }
    },
    {
      onSuccess: async () => {
        message.success('Risk level approval role updated successfully');
        await queryClient.invalidateQueries(WORKFLOWS_ITEM('risk-levels-approval', '_default'));
      },
      onError: (error) => {
        message.error('Failed to update risk level approval role', {
          details: getErrorMessage(error),
        });
      },
    },
  );

  // Set initial selected role when workflow loads
  React.useEffect(() => {
    if (currentWorkflow && currentWorkflow.approvalChain.length > 0) {
      setSelectedRole(currentWorkflow.approvalChain[0]);
    }
  }, [currentWorkflow]);

  // Determine if there are changes to save
  const currentRole = currentWorkflow?.approvalChain[0];
  const hasChanges = currentWorkflow != null ? currentRole !== selectedRole : selectedRole != null;

  if (!isApprovalWorkflowsEnabled) {
    return null;
  }

  return (
    <AsyncResourceRenderer resource={currentWorkflowQueryResult.data}>
      {() => (
        <SettingsCard
          title="Risk Level Approval Role"
          description="Configure the role that can approve or reject risk level changes. When this role is changed, a new default workflow will be created with the new role."
          minRequiredResources={['read:::settings/risk-scoring/risk-levels-approval/*']}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Approval Role</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Select
                value={selectedRole}
                options={roleOptions}
                isLoading={isLoading(updateWorkflowMutation.dataResource) || isLoadingRoles}
                isDisabled={!permissions}
                onChange={(newRole) => {
                  setSelectedRole(newRole == null ? currentRole : newRole);
                }}
                placeholder="Select a role"
                style={{ flex: 1 }}
              />
              <Button
                type="PRIMARY"
                size="SMALL"
                onClick={() => {
                  if (selectedRole) {
                    updateWorkflowMutation.mutate({ role: selectedRole });
                  }
                }}
                isDisabled={selectedRole == null || !permissions || !hasChanges}
                isLoading={isLoading(updateWorkflowMutation.dataResource) || isLoadingRoles}
              >
                Update Role
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}
    </AsyncResourceRenderer>
  );
};
