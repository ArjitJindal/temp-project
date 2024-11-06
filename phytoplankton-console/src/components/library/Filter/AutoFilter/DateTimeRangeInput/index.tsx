import React, { useCallback, useEffect, useState } from 'react';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { ChildrenProps as QuickFilterChildrenProps } from '@/components/library/QuickFilter/QuickFilterBase';
import { dayjs } from '@/utils/dayjs';
import { useIsChanged } from '@/utils/hooks';
import DateRangePicker from '@/components/library/DateRangePicker';
import Button from '@/components/library/Button';

export default function DateTimeRangeInput(
  props: InputProps<[string | undefined, string | undefined]> &
    QuickFilterChildrenProps & {
      clearNotAllowedReason?: string;
    },
) {
  const { value, onChange, allowClear, clearNotAllowedReason, isOpen, setOpen } = props;

  const [localState, setLocalState] = useState<
    [string | undefined, string | undefined] | undefined
  >(value ?? [dayjs().subtract(1, 'day').startOf('day').format(), dayjs().endOf('day').format()]);

  const localStart = localState?.[0];
  const localEnd = localState?.[1];

  const isLocalStateValid =
    allowClear || (localState != null && localStart != null && localEnd != null);

  const handleCancel = useCallback(() => {
    setOpen(false);
    if (value != null) {
      setLocalState?.(value);
    }
  }, [setOpen, value]);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    if (isLocalStateValid) {
      onChange?.(localState?.[0] == null && localState?.[1] == null ? undefined : localState);
    }
  }, [localState, isLocalStateValid, setOpen, onChange]);

  const isOpenChanged = useIsChanged(isOpen);
  useEffect(() => {
    const popoverJustClosed = isOpenChanged && !isOpen;
    if (popoverJustClosed && value != null) {
      setLocalState?.(value);
    }
  }, [isOpen, isOpenChanged, value]);

  return (
    <div className={s.root}>
      <DateRangePicker
        key={`${isOpen}`}
        value={[localStart ? dayjs(localStart) : undefined, localEnd ? dayjs(localEnd) : undefined]}
        onChange={(newValue) => {
          setLocalState(
            newValue ? [newValue[0]?.format(), newValue[1]?.format()] : [undefined, undefined],
          );
        }}
        allowClear={[allowClear ?? true, allowClear ?? true]}
        clearNotAllowedTooltip={clearNotAllowedReason}
      />
      <div className={s.footer}>
        <Button isDisabled={!isLocalStateValid} onClick={handleConfirm}>
          Confirm
        </Button>
        <Button type={'SECONDARY'} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
