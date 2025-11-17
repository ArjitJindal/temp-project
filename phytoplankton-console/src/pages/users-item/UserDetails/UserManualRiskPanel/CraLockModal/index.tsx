import React, { useState, useMemo, useEffect } from 'react';
import s from './index.module.less';
import { dayjs } from '@/utils/dayjs';
import Modal from '@/components/library/Modal';
import TextArea from '@/components/library/TextArea';
import NumberInput from '@/components/library/NumberInput';
import Select from '@/components/library/Select';
import Toggle from '@/components/library/Toggle';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel } from '@/utils/risk-levels';
import { MAX_CRA_LOCK_DURATION_DAYS } from '@/constants/cra-lock-timer';

export interface CraLockModalData {
  lockedAt?: number;
  lockExpiresAt?: number;
  currentRiskLevel?: RiskLevel; // For unified mode
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    isUpdatable: boolean;
    comment: string;
    releaseAt?: number;
    riskLevel?: RiskLevel; // For unified mode
  }) => void;
  isLocked: boolean;
  lockData?: CraLockModalData;
  isLoading?: boolean;
  // New props for unified mode
  isUnifiedMode?: boolean; // When true, shows risk level selection
  selectedRiskLevel?: RiskLevel; // Pre-selected risk level for unified mode
}

type ModalMode = 'lock' | 'unlock' | 'edit';

export default function CraLockModal(props: Props) {
  const {
    isOpen,
    onClose,
    onConfirm,
    isLocked,
    lockData,
    isLoading,
    isUnifiedMode = false,
    selectedRiskLevel,
  } = props;
  const settings = useSettings();

  // Risk level state for unified mode
  const [riskLevel, setRiskLevel] = useState<RiskLevel | undefined>(selectedRiskLevel);
  // Determine modal mode
  const mode: ModalMode = useMemo(() => {
    if (!isLocked) {
      return 'lock';
    }
    return 'unlock'; // Default to unlock when locked
  }, [isLocked]);

  const [editMode, setEditMode] = useState<ModalMode>(mode);

  const [hasExpiration, setHasExpiration] = useState<boolean>(false);
  const [durationDays, setDurationDays] = useState<number>(1);
  const [reason, setReason] = useState('');

  // Reset modal state when opened - calculate fresh values each time
  useEffect(() => {
    if (isOpen) {
      setEditMode(mode);
      setReason('');
      setRiskLevel(selectedRiskLevel); // Reset risk level for unified mode

      // Calculate initial values based on current state
      // Only treat as existing lock if we're in unlock/edit mode (isLocked = true)
      if (isLocked && lockData?.lockedAt && lockData?.lockExpiresAt) {
        // Existing lock with expiration - editing it
        const durationMs = lockData.lockExpiresAt - lockData.lockedAt;
        const existingDurationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
        const finalDays =
          existingDurationDays > 0 ? existingDurationDays : settings.craLockTimerDays || 1;
        setDurationDays(finalDays);
        setHasExpiration(true);
      } else if (isLocked && lockData?.lockedAt && !lockData?.lockExpiresAt) {
        // Existing perpetual lock - default to OFF (perpetual)
        const finalDays = settings.craLockTimerDays || 1;
        setDurationDays(finalDays);
        setHasExpiration(false);
      } else {
        // New lock - default to expiration if tenant default is set, otherwise perpetual
        const defaultDays = settings.craLockTimerDays || 1;
        setDurationDays(defaultDays);
        // Default to ON if tenant has default expiration set, otherwise OFF (perpetual)
        setHasExpiration(settings.craLockTimerDays != null);
      }
    }
  }, [isOpen, mode, lockData, settings.craLockTimerDays, selectedRiskLevel, isLocked]);

  const handleDurationChange = (value: number | undefined) => {
    if (!value) {
      return;
    }
    // Only allow positive integers
    const intValue = Math.max(1, Math.floor(Math.abs(value)));
    setDurationDays(intValue);
  };

  const getTitle = () => {
    if (isUnifiedMode) {
      return 'Update CRA risk level';
    }

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
    if (isUnifiedMode) {
      return 'Update and lock';
    }

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
        return 'Write a narrative explaining the risk level override reason.';
      case 'unlock':
        return 'Write a narrative explaining the risk level unlock reason.';
      case 'edit':
        return 'Write a narrative explaining the change in risk level lock duration.';
    }
  };

  const handleConfirm = () => {
    // Calculate releaseAt timestamp
    // For perpetual locks (hasExpiration = false), releaseAt is undefined
    let releaseAt: number | undefined = undefined;
    if (editMode !== 'unlock' && hasExpiration && durationDays) {
      const durationMs = durationDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      releaseAt = Date.now() + durationMs;
    }

    onConfirm({
      isUpdatable: editMode === 'unlock',
      comment: reason,
      releaseAt,
      riskLevel: isUnifiedMode ? riskLevel : undefined, // Pass risk level only in unified mode
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
  const hasExpirationData = lockData?.lockExpiresAt; // Lock exists with expiration
  const isPerpetualLock = isLocked && !lockData?.lockExpiresAt; // Lock exists but no expiration

  // Check if trying to lock perpetually when already locked perpetually (no-op)
  const isNoOpPerpetualLock = isPerpetualLock && editMode === 'lock' && !hasExpiration;

  return (
    <Modal
      isOpen={isOpen}
      onCancel={onClose}
      title={getTitle()}
      okText={getButtonText()}
      onOk={handleConfirm}
      okProps={{
        isLoading: isLoading,
        isDisabled: !reason.trim() || (isUnifiedMode && !riskLevel) || isNoOpPerpetualLock,
      }}
    >
      <div className={s.container}>
        {/* Risk Level Selection - Only in unified mode */}
        {isUnifiedMode && (
          <div>
            <label className={s.fieldLabel}>
              CRA risk level <span className={s.requiredAsterisk}>*</span>
            </label>
            <RiskLevelSwitch value={riskLevel} onChange={setRiskLevel} />
          </div>
        )}

        {/* Set Expiration Toggle - only show in lock/edit mode */}
        {showDurationInputs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Toggle
              value={hasExpiration}
              onChange={(enabled) => {
                setHasExpiration(enabled ?? false);
                if (enabled && !durationDays) {
                  // Use tenant default if set, otherwise fall back to 1 day
                  setDurationDays(settings.craLockTimerDays || 1);
                }
              }}
            />
            <span>Set expiration</span>
          </div>
        )}

        {/* From - To Fields */}
        <div className={s.fieldRow}>
          <div className={s.fieldColumn}>
            <label className={s.fieldLabel}>
              Lock from <span className={s.requiredAsterisk}>*</span>
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
              hasExpiration ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <NumberInput
                      value={durationDays}
                      onChange={handleDurationChange}
                      min={1}
                      max={MAX_CRA_LOCK_DURATION_DAYS}
                    />
                  </div>
                  <span>days</span>
                </div>
              ) : (
                <Select
                  value="Perpetual"
                  options={[{ value: 'Perpetual', label: 'Perpetual' }]}
                  isDisabled
                  allowClear={false}
                />
              )
            ) : (
              <Select
                value={
                  hasExpirationData
                    ? formatDate(lockData?.lockExpiresAt)
                    : isPerpetualLock
                    ? 'Perpetual'
                    : 'No expiration set'
                }
                options={[
                  {
                    value: hasExpirationData
                      ? formatDate(lockData?.lockExpiresAt)
                      : isPerpetualLock
                      ? 'Perpetual'
                      : 'No expiration set',
                    label: hasExpirationData
                      ? formatDate(lockData?.lockExpiresAt)
                      : isPerpetualLock
                      ? 'Perpetual'
                      : 'No expiration set',
                  },
                ]}
                isDisabled
                allowClear={false}
              />
            )}
          </div>
        </div>

        {/* Edit expiry link - show below From/To in unlock mode */}
        {!showDurationInputs && (
          <div>
            <a
              onClick={() => {
                setEditMode('edit');
                // When setting expiry on a perpetual lock, default toggle to ON for convenience
                if (isPerpetualLock) {
                  setHasExpiration(true);
                }
              }}
              style={{ color: '#1890ff', cursor: 'pointer', fontSize: '14px' }}
            >
              {hasExpirationData ? 'Edit expiry' : 'Set expiry'}
            </a>
          </div>
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
            noResize
          />
        </div>
      </div>
    </Modal>
  );
}
