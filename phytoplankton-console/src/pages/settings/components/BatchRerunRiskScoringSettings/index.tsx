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
                description: 'Disable re-calculation of risk scores',
              },
              {
                label: 'Daily',
                value: 'DAILY',
                description:
                  'Re-calculate risk scores in the background if risk factors have changed on start of day in UTC',
              },
              {
                label: 'Weekly',
                value: 'WEEKLY',
                description:
                  'Re-calculate risk scores in the background if risk factors have changed on start of the first day of the week in UTC',
              },
              {
                label: 'Monthly',
                value: 'MONTHLY',
                description:
                  'Re-calculate risk scores in the background if risk factors have changed on start of the first day of the month in UTC',
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
            text="Are you sure you want to re-run risk scoring? Only KRS and CRA will be re-calculated transactions will be re-calculated."
            onConfirm={() => {
              setIsRerun(true);
              triggerBulkRerunRiskScoring.mutate();
            }}
          >
            {({ onClick }) => (
              <Button
                type="SECONDARY"
                isDisabled={
                  !permissions ||
                  bulkRerunUsersStatus.isLoading ||
                  bulkRerunUsersStatus.data.isAnyJobRunning ||
                  bulkRerunUsersStatus.data.count >=
                    (settings.limits?.rerunRiskScoringLimit || 0) ||
                  settings.riskScoringAlgorithm?.type === 'FORMULA_LEGACY_MOVING_AVG' ||
                  isRerun
                }
                onClick={onClick}
              >
                Rerun now
              </Button>
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
