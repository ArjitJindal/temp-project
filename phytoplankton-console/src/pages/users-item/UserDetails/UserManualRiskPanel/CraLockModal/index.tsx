import React, { useState, useMemo, useEffect } from 'react';
import s from './index.module.less';
import { dayjs } from '@/utils/dayjs';
import Modal from '@/components/library/Modal';
import Button from '@/components/library/Button';
import TextArea from '@/components/library/TextArea';
import NumberInput from '@/components/library/NumberInput';
import Select from '@/components/library/Select';
import Alert from '@/components/library/Alert';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { MAX_CRA_LOCK_DURATION_DAYS } from '@/constants/cra-lock-timer';

export interface CraLockModalData {
  lockedAt?: number;
  lockExpiresAt?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { isUpdatable: boolean; comment: string; releaseAt?: number }) => void;
  isLocked: boolean;
  lockData?: CraLockModalData;
  isLoading?: boolean;
}

type ModalMode = 'lock' | 'unlock' | 'edit';

export default function CraLockModal(props: Props) {
  const { isOpen, onClose, onConfirm, isLocked, lockData, isLoading } = props;
  const settings = useSettings();

  // Determine modal mode
  const mode: ModalMode = useMemo(() => {
    if (!isLocked) {
      return 'lock';
    }
    return 'unlock'; // Default to unlock when locked
  }, [isLocked]);

  const [editMode, setEditMode] = useState<ModalMode>(mode);

  // Initialize duration based on existing lock or tenant default
  const initialDuration = useMemo(() => {
    if (lockData?.lockedAt && lockData?.lockExpiresAt) {
      // Calculate existing lock duration in hours
      const durationMs = lockData.lockExpiresAt - lockData.lockedAt;
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      return durationHours > 0 ? durationHours : settings.craLockTimerHours || 24;
    }
    return settings.craLockTimerHours || 24;
  }, [lockData, settings.craLockTimerHours]);

  // Convert hours to best display unit (days if evenly divisible by 24, hours otherwise)
  const getDisplayValue = (hours: number) => {
    if (hours % 24 === 0 && hours >= 24) {
      return { value: hours / 24, unit: 'days' as const };
    }
    return { value: hours, unit: 'hours' as const };
  };

  // Initialize with appropriate unit based on duration
  const initialDisplay = useMemo(() => {
    return getDisplayValue(initialDuration);
  }, [initialDuration]);

  const [durationValue, setDurationValue] = useState<number>(initialDuration);
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>(initialDisplay.unit);
  const [reason, setReason] = useState('');

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setEditMode(mode);
      setReason('');
      const display = getDisplayValue(initialDuration);
      setDurationValue(initialDuration); // Always store as hours internally
      setDurationUnit(display.unit); // Set appropriate unit for display
    }
  }, [isOpen, mode, initialDuration]);

  // Convert hours to display value based on unit
  const displayDuration = useMemo(() => {
    if (durationUnit === 'days') {
      return durationValue / 24; // Clean division since unit should only be 'days' for multiples of 24
    }
    return durationValue;
  }, [durationValue, durationUnit]);

  const handleDurationChange = (value: number | undefined) => {
    if (!value) {
      return;
    }
    // Only allow positive integers
    const intValue = Math.max(1, Math.floor(Math.abs(value)));
    const hours = durationUnit === 'days' ? intValue * 24 : intValue;
    setDurationValue(hours);
  };

  const getTitle = () => {
    switch (editMode) {
      case 'lock':
        return 'Lock CRA risk level';
      case 'unlock':
        return 'Unlock CRA risk level';
      case 'edit':
        return 'Edit CRA risk level expiry';
    }
  };

  const getButtonText = () => {
    switch (editMode) {
      case 'lock':
      case 'edit':
        return 'Lock';
      case 'unlock':
        return 'Unlock';
    }
  };

  const getReasonPlaceholder = () => {
    switch (editMode) {
      case 'lock':
        return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam';
      case 'unlock':
        return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam';
      case 'edit':
        return 'Add a reason for the updates made';
    }
  };

  const handleConfirm = () => {
    // Calculate releaseAt timestamp from displayed duration (not internal durationValue)
    let releaseAt: number | undefined = undefined;
    if (editMode !== 'unlock' && displayDuration) {
      // Convert displayed duration to hours based on current unit
      const hoursFromDisplay = durationUnit === 'days' ? displayDuration * 24 : displayDuration;
      const durationMs = hoursFromDisplay * 60 * 60 * 1000; // Convert hours to milliseconds
      releaseAt = Date.now() + durationMs;
    }

    onConfirm({
      isUpdatable: editMode === 'unlock',
      comment: reason,
      releaseAt,
    });
  };

  const formatDate = (dateValue?: number) => {
    if (!dateValue) {
      return '';
    }
    return dayjs(dateValue).format('MMM D, YYYY');
  };

  const showDurationInputs = editMode === 'lock' || editMode === 'edit';
  const showExistingDates = editMode === 'unlock';
  const hasExpirationData = lockData?.lockedAt && lockData?.lockExpiresAt;

  return (
    <Modal
      isOpen={isOpen}
      onCancel={onClose}
      title={getTitle()}
      okText={getButtonText()}
      onOk={handleConfirm}
      okProps={{
        isLoading: isLoading,
        isDisabled: !reason.trim(),
      }}
    >
      <div className={s.container}>
        {/* From Field */}
        <div className={s.fieldRow}>
          <div className={s.fieldColumn}>
            <label className={s.fieldLabel}>
              From <span className={s.requiredAsterisk}>*</span>
            </label>
            {showExistingDates ? (
              <Select
                value={formatDate(lockData?.lockedAt)}
                options={[
                  {
                    value: formatDate(lockData?.lockedAt),
                    label: formatDate(lockData?.lockedAt),
                  },
                ]}
                isDisabled
                allowClear={false}
              />
            ) : (
              <Select
                value="Today"
                options={[{ value: 'Today', label: 'Today' }]}
                isDisabled
                allowClear={false}
              />
            )}
          </div>

          {/* To Field */}
          <div className={s.fieldColumn}>
            <label className={s.fieldLabel}>
              To <span className={s.requiredAsterisk}>*</span>
            </label>
            {showDurationInputs ? (
              <div className={s.durationInputs}>
                <div className={s.durationValue}>
                  <NumberInput
                    value={displayDuration}
                    onChange={handleDurationChange}
                    min={1}
                    max={
                      durationUnit === 'days'
                        ? MAX_CRA_LOCK_DURATION_DAYS
                        : MAX_CRA_LOCK_DURATION_DAYS * 24
                    }
                  />
                </div>
                <div className={s.durationUnit}>
                  <Select
                    value={durationUnit}
                    onChange={(value) => {
                      const newUnit = value as 'hours' | 'days';
                      if (newUnit) {
                        setDurationUnit(newUnit);
                        // Convert the current value when switching units
                        if (newUnit === 'days' && durationUnit === 'hours') {
                          // Only convert if hours are divisible by 24 and >= 24
                          if (durationValue >= 24 && durationValue % 24 === 0) {
                            // Keep the current hour value, just changing display unit
                          } else {
                            // Reset to 1 day (24 hours) if can't convert cleanly
                            setDurationValue(24);
                          }
                        } else if (newUnit === 'hours' && durationUnit === 'days') {
                          // No conversion needed since durationValue is already in hours
                        }
                      }
                    }}
                    options={[
                      { value: 'hours', label: 'hours' },
                      { value: 'days', label: 'days' },
                    ]}
                    allowClear={false}
                  />
                </div>
              </div>
            ) : (
              <div className={s.unlockActions}>
                <Select
                  value={
                    hasExpirationData ? formatDate(lockData?.lockExpiresAt) : 'No expiration set'
                  }
                  options={[
                    {
                      value: hasExpirationData
                        ? formatDate(lockData?.lockExpiresAt)
                        : 'No expiration set',
                      label: hasExpirationData
                        ? formatDate(lockData?.lockExpiresAt)
                        : 'No expiration set',
                    },
                  ]}
                  isDisabled
                  allowClear={false}
                />
                <Button type="TETRIARY" onClick={() => setEditMode('edit')}>
                  {hasExpirationData ? 'Edit expiry' : 'Set expiry'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Info Alert for Edit Mode */}
        {editMode === 'edit' && (
          <Alert type="INFO">Editing the expiry would override previous configuration</Alert>
        )}

        {/* Reason Field */}
        <div>
          <label className={s.fieldLabel}>
            Reason <span className={s.requiredAsterisk}>*</span>
          </label>
          <TextArea
            value={reason}
            onChange={(value) => setReason(value || '')}
            placeholder={getReasonPlaceholder()}
            rows={4}
            minHeight="100px"
          />
        </div>
      </div>
    </Modal>
  );
}
