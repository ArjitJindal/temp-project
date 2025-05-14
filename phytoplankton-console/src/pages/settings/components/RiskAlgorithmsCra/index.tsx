import React, { useCallback, useState } from 'react';
import RiskAlgorithmsSelector, { RiskScoringCraAlgorithm } from './RiskAlgorithmsSelector';
import s from './styles.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SettingsCard from '@/components/library/SettingsCard';
import { isSuperAdmin, useAuth0User, useHasPermissions } from '@/utils/user-utils';
import Button from '@/components/library/Button';

export default function RiskAlgorithmsCra() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const user = useAuth0User();
  const superAdmin = isSuperAdmin(user);
  const permissions = useHasPermissions(['risk-scoring:risk-algorithms:read']);
  const currentAlgorithm = settings.riskScoringAlgorithm;
  const isCraEnabled = settings.riskScoringCraEnabled ?? true;
  const [localAlgorithm, setLocalAlgorithm] = useState<RiskScoringCraAlgorithm | undefined>(
    currentAlgorithm,
  );
  const handleUpdateRiskAlgorithm = useCallback((riskAlgorithm: RiskScoringCraAlgorithm) => {
    setLocalAlgorithm(riskAlgorithm);
  }, []);
  return isCraEnabled ? (
    <SettingsCard title={'Risk algorithms for CRA'}>
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
          isDisabled={!permissions || !superAdmin}
        >
          Update
        </Button>
      </div>
    </SettingsCard>
  ) : null;
}
