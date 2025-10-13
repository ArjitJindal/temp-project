import { useState, useMemo, useEffect } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import NumberInput from '@/components/library/NumberInput';
import Button from '@/components/library/Button';
import Toggle from '@/components/library/Toggle';
import Select from '@/components/library/Select';
import { useHasResources } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { MAX_CRA_LOCK_DURATION_DAYS } from '@/constants/cra-lock-timer';

export default function CraLockTimerSettings() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const permissions = useHasResources(['write:::settings/risk-scoring/cra-lock-timer/*']);

  // Convert hours to best display unit (days if evenly divisible by 24, hours otherwise)
  const getDisplayValue = (hours: number) => {
    if (hours % 24 === 0 && hours >= 24) {
      return { value: hours / 24, unit: 'days' as const };
    }
    return { value: hours, unit: 'hours' as const };
  };

  // Initialize with current settings
  const initialDisplay = useMemo(() => {
    const currentHours = settings.craLockTimerHours ?? 24;
    return getDisplayValue(currentHours);
  }, [settings.craLockTimerHours]);

  const [durationValue, setDurationValue] = useState<number>(initialDisplay.value);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>(initialDisplay.unit);
  const [isEnabled, setIsEnabled] = useState<boolean>(
    settings.craLockTimerHours !== undefined && settings.craLockTimerHours > 0,
  );

  // Sync local state with settings when craLockTimerHours changes
  useEffect(() => {
    const currentHours = settings.craLockTimerHours ?? 24;
    const display = getDisplayValue(currentHours);

    setDurationValue(display.value);
    setDurationUnit(display.unit);
    setIsEnabled(settings.craLockTimerHours !== undefined && settings.craLockTimerHours > 0);
  }, [settings.craLockTimerHours]);

  // Convert display value to hours for storage
  const getHoursValue = (value: number, unit: 'hours' | 'days') => {
    return unit === 'days' ? value * 24 : value;
  };

  const handleUpdate = () => {
    if (!isEnabled) {
      // Remove default duration setting (undefined)
      mutateTenantSettings.mutate({
        craLockTimerHours: undefined,
      });
      return;
    }

    if (durationValue <= 0) {
      message.error('Default duration must be greater than 0');
      return;
    }

    const hoursValue = getHoursValue(durationValue, durationUnit);
    if (hoursValue > MAX_CRA_LOCK_DURATION_DAYS * 24) {
      // 365 days max
      message.error('Default duration cannot exceed 365 days');
      return;
    }

    mutateTenantSettings.mutate({
      craLockTimerHours: hoursValue,
    });
  };

  return (
    <div>
      <SettingsCard
        title="CRA Lock Timer Default"
        description="Default duration for CRA locks. Users can override this when locking individual CRAs."
        minRequiredResources={['read:::settings/risk-scoring/cra-lock-timer/*']}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Toggle
              value={isEnabled}
              onChange={(enabled) => {
                setIsEnabled(enabled ?? false);
                if (enabled && durationValue === 0) {
                  setDurationValue(24); // Default to 24 hours when enabling
                  setDurationUnit('hours');
                }
              }}
              isDisabled={!permissions}
            />
            <span>Set default CRA lock duration</span>
          </div>

          {isEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '100px' }}>
                <NumberInput
                  value={durationValue || undefined}
                  onChange={(value) => {
                    // Only allow positive integers
                    const intValue = value ? Math.max(1, Math.floor(Math.abs(value))) : 0;
                    setDurationValue(intValue);
                  }}
                  placeholder="Duration"
                  min={1}
                  max={
                    durationUnit === 'days'
                      ? MAX_CRA_LOCK_DURATION_DAYS
                      : MAX_CRA_LOCK_DURATION_DAYS * 24
                  }
                  isDisabled={!permissions}
                />
              </div>
              <div style={{ width: '100px' }}>
                <Select
                  value={durationUnit}
                  onChange={(unit) => {
                    if (unit) {
                      setDurationUnit(unit);
                      // Convert the current value when switching units
                      if (unit === 'days' && durationUnit === 'hours') {
                        // Only convert if hours are divisible by 24 and >= 24
                        if (durationValue >= 24 && durationValue % 24 === 0) {
                          setDurationValue(durationValue / 24);
                        } else {
                          // Clear value if can't convert cleanly to days
                          setDurationValue(1);
                        }
                      } else if (unit === 'hours' && durationUnit === 'days') {
                        setDurationValue(durationValue * 24);
                      }
                    }
                  }}
                  options={[
                    { value: 'hours', label: 'hours' },
                    { value: 'days', label: 'days' },
                  ]}
                  isDisabled={!permissions}
                  allowClear={false}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Button
              type="PRIMARY"
              onClick={handleUpdate}
              isLoading={mutateTenantSettings.isLoading}
              isDisabled={
                !permissions ||
                (isEnabled &&
                  getHoursValue(durationValue, durationUnit) === settings.craLockTimerHours) ||
                (!isEnabled && settings.craLockTimerHours === undefined)
              }
            >
              Update
            </Button>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {isEnabled
                ? `Range: ${
                    durationUnit === 'days'
                      ? `${MAX_CRA_LOCK_DURATION_DAYS} days`
                      : `${MAX_CRA_LOCK_DURATION_DAYS * 24} hours`
                  } (max ${MAX_CRA_LOCK_DURATION_DAYS} days). This will be the default when users lock CRAs.`
                : 'No default duration set. Users must specify duration when locking CRAs.'}
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
