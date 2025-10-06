import { useState } from 'react';
import s from './index.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Label from '@/components/library/Label';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { useHasResources } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';
import { useBulkRerunUsersStatus, useTriggerBulkRerunRiskScoring } from '@/utils/batch-rerun-users';
import { TenantSettingsBatchRerunRiskScoringFrequencyEnum } from '@/apis';
import Tooltip from '@/components/library/Tooltip';

export default function BatchRerunRiskScoringSettings() {
  const settings = useSettings();
  const [rerunFrequency, setRerunFrequency] =
    useState<TenantSettingsBatchRerunRiskScoringFrequencyEnum>(
      settings.batchRerunRiskScoringFrequency || 'DISABLED',
    );
  const [isRerun, setIsRerun] = useState(false);
  const permissions = useHasResources([
    'write:::settings/risk-scoring/batch-rerun-risk-scoring-settings/*',
  ]);
  const updateTenantSettings = useUpdateTenantSettings();
  const bulkRerunUsersStatus = useBulkRerunUsersStatus();
  const triggerBulkRerunRiskScoring = useTriggerBulkRerunRiskScoring();
  const hasNoPermissions = !permissions;
  const isLoading = bulkRerunUsersStatus.isLoading;
  const hasRunningJobs = bulkRerunUsersStatus.data.isAnyJobRunning;
  const hasReachedLimit =
    bulkRerunUsersStatus.data.count >= (settings.limits?.rerunRiskScoringLimit || 0);
  const isLegacyAlgorithm = settings.riskScoringAlgorithm?.type === 'FORMULA_LEGACY_MOVING_AVG';
  const isDisabled =
    hasNoPermissions ||
    isLoading ||
    hasRunningJobs ||
    hasReachedLimit ||
    isLegacyAlgorithm ||
    isRerun;

  return (
    <SettingsCard
      title="Re-calculate risk scores"
      description="Re-calculate KRS and CRA of all Users"
    >
      <div>
        <Label label="Rerun frequency">
          <SelectionGroup
            isDisabled={!permissions}
            mode="SINGLE"
            options={[
              {
                label: 'Disabled',
                value: 'DISABLED',
                description: 'Do not recalculate risk scores',
              },
              {
                label: 'Daily',
                value: 'DAILY',
                description:
                  'Recalculate risk scores in the background at the start of each day (UTC) if risk factors have changed',
              },
              {
                label: 'Weekly',
                value: 'WEEKLY',
                description:
                  'Recalculate risk scores in the background at the start of each week (UTC) if risk factors have changed',
              },
              {
                label: 'Monthly',
                value: 'MONTHLY',
                description:
                  'Recalculate risk scores in the background at the start of each month (UTC) if risk factors have changed',
              },
            ]}
            value={rerunFrequency}
            onChange={(value) => {
              if (value) {
                setRerunFrequency(value);
              }
            }}
          />
        </Label>
        <div className={s.buttonContainer}>
          <Button
            type="PRIMARY"
            onClick={() => {
              if (rerunFrequency) {
                updateTenantSettings.mutate({
                  batchRerunRiskScoringFrequency: rerunFrequency,
                });
              }
            }}
          >
            Save
          </Button>
          <Confirm
            title="Rerun risk scoring"
            text="Are you sure you want to rerun risk scoring? Only KRS and CRA will be recalculated. Transactions will not be recalculated.."
            onConfirm={() => {
              setIsRerun(true);
              triggerBulkRerunRiskScoring.mutate();
            }}
          >
            {({ onClick }) => (
              <Tooltip
                title={
                  isDisabled
                    ? `Your rerun quota has been exhausted. Please contact support@flagright.com to increase your quota.`
                    : undefined
                }
                placement="topRight"
              >
                <Button type="SECONDARY" isDisabled={isDisabled} onClick={onClick}>
                  Rerun now
                </Button>
              </Tooltip>
            )}
          </Confirm>
        </div>
        {bulkRerunUsersStatus.data.isAnyJobRunning &&
          (bulkRerunUsersStatus.data?.sentCount ?? 0) > 0 && (
            <div>
              {bulkRerunUsersStatus.data.processedCount} / {bulkRerunUsersStatus.data.sentCount}{' '}
              users re-calculated
            </div>
          )}
      </div>
    </SettingsCard>
  );
}
