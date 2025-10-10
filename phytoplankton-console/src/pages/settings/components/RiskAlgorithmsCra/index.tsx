import React, { useCallback, useMemo, useState } from 'react';
import RiskAlgorithmsSelector, { RiskScoringCraAlgorithm } from './RiskAlgorithmsSelector';
import s from './styles.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SettingsCard from '@/components/library/SettingsCard';
import { isSuperAdmin, useAuth0User, useHasResources, useTenantInfo } from '@/utils/user-utils';
import Button from '@/components/library/Button';
import { dayjs } from '@/utils/dayjs';

export default function RiskAlgorithmsCra() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const user = useAuth0User();
  const superAdmin = isSuperAdmin(user);
  const tenantInfo = useTenantInfo();

  const permissions = useHasResources(['read:::settings/risk-scoring/risk-algorithms-cra/*']);
  const hasWritePermission = useHasResources([
    'write:::settings/risk-scoring/risk-algorithms-cra/*',
  ]);
  const currentAlgorithm = settings.riskScoringAlgorithm;
  const isCraEnabled = settings.riskScoringCraEnabled ?? true;
  const [localAlgorithm, setLocalAlgorithm] = useState<RiskScoringCraAlgorithm | undefined>(
    currentAlgorithm,
  );

  const canChangeRiskAlgo = useMemo(() => {
    const tenantCreatedAt = tenantInfo?.tenantCreatedAt ?? '0';
    try {
      // tenantCreatedAt is a Unix timestamp in milliseconds
      const timestampNumber = parseInt(tenantCreatedAt, 10);
      const creationDate = dayjs(timestampNumber);

      // tenant created on or after 1st July 2025 are considered as new
      const cutoffDate = dayjs('2025-07-01');
      const isAfterCutoff =
        creationDate.isAfter(cutoffDate) || creationDate.isSame(cutoffDate, 'day');
      if (creationDate.isValid() && isAfterCutoff) {
        return true && currentAlgorithm?.type === 'FORMULA_SIMPLE_AVG';
      }
      return false;
    } catch (error) {
      console.error('Error processing tenant creation date:', error);
      return false;
    }
  }, [tenantInfo, currentAlgorithm]);

  const handleUpdateRiskAlgorithm = useCallback((riskAlgorithm: RiskScoringCraAlgorithm) => {
    setLocalAlgorithm(riskAlgorithm);
  }, []);

  return isCraEnabled ? (
    <SettingsCard
      title={'Risk algorithms for CRA'}
      minRequiredResources={['read:::settings/risk-scoring/risk-algorithms-cra/*']}
    >
      <RiskAlgorithmsSelector
        hasPermissions={permissions}
        handleUpdateAlgorithm={handleUpdateRiskAlgorithm}
        isUpdateDisabled={!superAdmin}
        currentAlgorithm={localAlgorithm}
        defaultAlgorithmType="FORMULA_LEGACY_MOVING_AVG"
      />
      <div className={s.buttonContainer}>
        <Button
          onClick={() => {
            mutateTenantSettings.mutate({ riskScoringAlgorithm: localAlgorithm });
          }}
          // should be disabled when no persmission
          // can edit when a new tenant or a super admin
          isDisabled={!permissions || !((canChangeRiskAlgo && hasWritePermission) || superAdmin)}
        >
          Update
        </Button>
      </div>
    </SettingsCard>
  ) : null;
}
