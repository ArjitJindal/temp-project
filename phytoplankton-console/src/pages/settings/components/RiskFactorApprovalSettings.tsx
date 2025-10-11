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
import { RiskFactorsApprovalWorkflow } from '@/apis';
import { formatRoleName } from '@/pages/accounts/utils';
import { useWorkflowById } from '@/hooks/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { RISK_FACTOR_WORKFLOW_PROPOSAL, WORKFLOWS_ITEM } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

export const RiskFactorApprovalSettings: React.FC = () => {
  const api = useApi();
  const queryClient = useQueryClient();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  // todo: use factors permissions
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
  const currentWorkflowQueryResult = useWorkflowById('risk-factors-approval', '_default');
  React.useEffect(() => {
    const data = getOr(currentWorkflowQueryResult.data, null) as RiskFactorsApprovalWorkflow | null;
    if (data != null && data.approvalChain.length > 0) {
      setSelectedRole(data.approvalChain[0]);
    }
  }, [currentWorkflowQueryResult.data]);

  const currentWorkflow = getOr(
    currentWorkflowQueryResult.data,
    null,
  ) as RiskFactorsApprovalWorkflow | null;

  // Update workflow mutation
  const updateWorkflowMutation = useMutation<unknown, unknown, { role: string }>(
    async ({ role }) => {
      const closeMessage = message.loading('Applying changes...');
      try {
        const payload = {
          riskFactorsApprovalWorkflow: {
            name: 'Risk Factor Approval Workflow - Reviewer Workflow',
            description:
              'Single-step rule approval workflow where a reviewer role can approve or reject rule change proposals',
            enabled: true,
            approvalChain: [role],
          },
        };

        return await api.postWorkflowVersion({
          workflowType: 'risk-factors-approval',
          workflowId: '_default',
          CreateWorkflowType: payload,
        });
      } finally {
        closeMessage();
      }
    },
    {
      onSuccess: async () => {
        message.success('Risk factor approval role updated successfully');
        await queryClient.invalidateQueries(WORKFLOWS_ITEM('risk-factors-approval', '_default'));
        // Invalidate proposal since we change proposal when change role
        await queryClient.invalidateQueries(RISK_FACTOR_WORKFLOW_PROPOSAL());
      },
      onError: (error) => {
        message.error('Failed to update risk factor approval role', {
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
          title="Risk Factor Approval Role"
          description="Configure the role that can approve or reject risk factor changes. When this role is changed, a new default workflow will be created with the new role."
          minRequiredResources={['read:::settings/risk-scoring/risk-levels-approval/*']}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Approval Role</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <Select
                  value={selectedRole}
                  options={roleOptions}
                  isLoading={isLoading(updateWorkflowMutation.dataResource) || isLoadingRoles}
                  isDisabled={!permissions}
                  onChange={(newRole) => {
                    setSelectedRole(newRole == null ? currentRole : newRole);
                  }}
                  placeholder="Select a role"
                />
              </div>
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
