import { useState, useEffect } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import NumberInput from '@/components/library/NumberInput';
import Button from '@/components/library/Button';
import Toggle from '@/components/library/Toggle';
import { useHasResources } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { MAX_CRA_LOCK_DURATION_DAYS } from '@/constants/cra-lock-timer';

export default function CraLockTimerSettings() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const permissions = useHasResources(['write:::settings/risk-scoring/cra-lock-timer/*']);

  const [durationDays, setDurationDays] = useState<number>(settings.craLockTimerDays ?? 1);
  const [isEnabled, setIsEnabled] = useState<boolean>(
    settings.craLockTimerDays != null && settings.craLockTimerDays > 0,
  );
  // Track the last saved value to compare against
  const [savedDurationDays, setSavedDurationDays] = useState<number | undefined>(
    settings.craLockTimerDays ?? undefined,
  );

  // Sync local state with settings when craLockTimerDays changes
  useEffect(() => {
    if (settings.craLockTimerDays != null) {
      setDurationDays(settings.craLockTimerDays);
      setSavedDurationDays(settings.craLockTimerDays);
      setIsEnabled(true);
    } else {
      setSavedDurationDays(undefined);
      setIsEnabled(false);
    }
  }, [settings.craLockTimerDays]);

  const handleToggleChange = async (enabled: boolean | undefined) => {
    const newEnabled = enabled ?? false;
    setIsEnabled(newEnabled);

    if (!newEnabled) {
      // Instantly update settings when toggling OFF
      // Send 0 as sentinel value to unset (backend converts to null)
      await mutateTenantSettings.mutateAsync({
        craLockTimerDays: 0,
      });
      setSavedDurationDays(undefined);
    } else if (durationDays === 0) {
      // Set default value when enabling
      setDurationDays(1);
    }
  };

  const handleUpdate = async () => {
    if (durationDays <= 0) {
      message.error('Default duration must be greater than 0');
      return;
    }

    if (durationDays > MAX_CRA_LOCK_DURATION_DAYS) {
      message.error(`Default duration cannot exceed ${MAX_CRA_LOCK_DURATION_DAYS} days`);
      return;
    }

    await mutateTenantSettings.mutateAsync({
      craLockTimerDays: durationDays,
    });
    // Update saved value after successful mutation
    setSavedDurationDays(durationDays);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = isEnabled && durationDays !== savedDurationDays;

  return (
    <div>
      <SettingsCard
        title="CRA lock default expiry period"
        description="When enabled, a default expiry duration can be configured for the CRA level lock. This default setting can be overridden at the time of CRA locking from user's profile."
        minRequiredResources={['read:::settings/risk-scoring/cra-lock-timer/*']}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Toggle value={isEnabled} onChange={handleToggleChange} isDisabled={!permissions} />
          </div>

          {isEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100px' }}>
                <NumberInput
                  value={durationDays || undefined}
                  onChange={(value) => {
                    // Only allow positive integers
                    const intValue = value ? Math.max(1, Math.floor(Math.abs(value))) : 1;
                    setDurationDays(intValue);
                  }}
                  placeholder="Duration"
                  min={1}
                  max={MAX_CRA_LOCK_DURATION_DAYS}
                  isDisabled={!permissions}
                />
              </div>
              <span>days</span>
            </div>
          )}

          {isEnabled && (
            <div>
              <Button
                type="PRIMARY"
                onClick={handleUpdate}
                isLoading={mutateTenantSettings.isLoading}
                isDisabled={!permissions || !hasUnsavedChanges}
              >
                Update
              </Button>
            </div>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
