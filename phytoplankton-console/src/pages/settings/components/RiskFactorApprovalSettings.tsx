import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SettingsCard from '@/components/library/SettingsCard';
import Select from '@/components/library/Select';
import { useHasResources } from '@/utils/user-utils';
import {
  useFeatureEnabled,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import Button from '@/components/library/Button';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { RISK_FACTOR_WORKFLOW_PROPOSAL, SETTINGS } from '@/utils/queries/keys';
import { getOr, isLoading, isSuccess, map } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRiskApprovalSettings, useWorkflowListByType } from '@/utils/api/workflows';

export const RiskFactorApprovalSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  // todo: use factors permissions
  const permissions = useHasResources(['write:::settings/risk-scoring/risk-levels-approval/*']);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const workflowListQueryResult = useWorkflowListByType('change-approval');

  // Fetch current workflow configuration
  const riskApprovalSettings = useRiskApprovalSettings();
  const currentWorkflowRes = map(riskApprovalSettings, (x) => x.riskFactorsApprovalWorkflow);
  const currentWorkflow = getOr(currentWorkflowRes, null);

  const mutateTenantSettings = useUpdateTenantSettings();
  const hasInitialized = React.useRef(false);

  // Update workflow mutation
  const updateWorkflowMutation = useMutation<unknown, unknown, { workflowId: string | null }>(
    async ({ workflowId }) => {
      const closeMessage = message.loading('Applying changes...');
      try {
        await mutateTenantSettings.mutateAsync({
          workflowSettings: {
            riskFactorsApprovalWorkflow: workflowId ?? '', // Use empty string as sentinel to unset
          },
        });
        return workflowId; // Return the saved value
      } finally {
        closeMessage();
      }
    },
    {
      onSuccess: async () => {
        message.success('Risk factor approval workflow updated successfully');
        // Don't reset hasInitialized - the value is already correct
        await Promise.all([
          queryClient.invalidateQueries(RISK_FACTOR_WORKFLOW_PROPOSAL()),
          queryClient.invalidateQueries(SETTINGS()),
        ]);
      },
      onError: (error) => {
        message.error('Failed to update risk factor approval workflow', {
          details: getErrorMessage(error),
        });
      },
    },
  );

  // Set initial selected workflow when data loads (only once per change)
  React.useEffect(() => {
    if (isSuccess(currentWorkflowRes) && !hasInitialized.current) {
      setSelectedWorkflowId(currentWorkflowRes.value?.id ?? null);
      hasInitialized.current = true;
    }
  }, [currentWorkflowRes]);

  // Determine if there are changes to save
  const currentWorkflowId = currentWorkflow?.id ?? null;
  const hasChanges = currentWorkflowId !== selectedWorkflowId;

  if (!isApprovalWorkflowsEnabled) {
    return null;
  }

  return (
    <AsyncResourceRenderer resource={currentWorkflowRes}>
      {() => (
        <SettingsCard
          title="Risk factor approval workflow"
          description="Configure the workflow to use for risk factors changes"
          minRequiredResources={['read:::settings/risk-scoring/risk-levels-approval/*']}
        >
          <div style={{ marginBottom: '16px' }}>
            <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Approval workflow</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <Select
                  value={selectedWorkflowId}
                  options={getOr(workflowListQueryResult.data, []).map((workflow) => ({
                    label: workflow.id + ': ' + workflow.name,
                    value: workflow.id,
                  }))}
                  isLoading={
                    isLoading(updateWorkflowMutation.dataResource) ||
                    isLoading(workflowListQueryResult.data)
                  }
                  isDisabled={!permissions}
                  onChange={(newValue) => {
                    setSelectedWorkflowId(newValue ?? null);
                  }}
                  placeholder="Select a workflow"
                />
              </div>
              <Button
                type="PRIMARY"
                size="SMALL"
                onClick={() => {
                  updateWorkflowMutation.mutate({ workflowId: selectedWorkflowId });
                }}
                isDisabled={!permissions || !hasChanges}
                isLoading={
                  isLoading(updateWorkflowMutation.dataResource) ||
                  isLoading(workflowListQueryResult.data)
                }
              >
                Update workflow
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}
    </AsyncResourceRenderer>
  );
};
