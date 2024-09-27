import React, { useCallback, useEffect, useState } from 'react';
import { Dayjs } from 'dayjs';
import s from './index.module.less';
import DateRangeValuePopover from './DateRangeValuePopover';
import DateTimeTextInput, { DATE_TIME_FORMAT } from './DateTimeTextInput';
import ArrowRightLineIcon from '@/components/ui/icons/Remix/system/arrow-right-line.react.svg';
import { InputProps } from '@/components/library/Form';
import { useIsChanged, usePrevious } from '@/utils/hooks';
import { applyUpdater, Updater } from '@/utils/state';

type Value = [Dayjs | undefined, Dayjs | undefined];

type Props = Omit<InputProps<Value>, 'allowClear'> & {
  allowClear?: [boolean, boolean];
  clearNotAllowedTooltip?: string;
};

export default function DateRangePicker(props: Props) {
  const { allowClear = [true, true], clearNotAllowedTooltip, value, onChange } = props;

  const [localValue, setLocalValue] = useState(value);

  const [startValue, endValue] = localValue ?? [];

  const [startText, setStartText] = useState<string | undefined>(
    startValue?.format(DATE_TIME_FORMAT) ?? '',
  );
  const [endText, setEndText] = useState<string | undefined>(
    endValue?.format(DATE_TIME_FORMAT) ?? '',
  );
  const [startPopoverVisible, setStartPopoverVisible] = useState(false);
  const [endPopoverVisible, setEndPopoverVisible] = useState(false);

  const isStartPopoverVisibleChanged = useIsChanged(startPopoverVisible);
  const isEndPopoverVisibleChanged = useIsChanged(endPopoverVisible);

  const handleCommitLocalValue = useCallback(() => {
    onChange?.(localValue);
  }, [localValue, onChange]);

  const handleUpdateLocalValue = useCallback((updater: Updater<Value | undefined>) => {
    setLocalValue((oldValue) => {
      let result = applyUpdater(oldValue, updater);
      if (result?.[0] == null && result?.[1] == null) {
        result = undefined;
      }
      return result;
    });
  }, []);

  useEffect(() => {
    if (isStartPopoverVisibleChanged) {
      if (startPopoverVisible || (!allowClear[0] && !localValue?.[0])) {
        handleUpdateLocalValue((localValue) => [value?.[0], localValue?.[1]]);
      } else {
        handleCommitLocalValue();
      }
    }
    if (isEndPopoverVisibleChanged) {
      if (endPopoverVisible || (!allowClear[1] && !localValue?.[1])) {
        handleUpdateLocalValue((localValue) => [localValue?.[0], value?.[1]]);
      } else {
        handleCommitLocalValue();
      }
    }
  }, [
    value,
    handleCommitLocalValue,
    endPopoverVisible,
    startPopoverVisible,
    isEndPopoverVisibleChanged,
    isStartPopoverVisibleChanged,
    localValue,
    allowClear,
    handleUpdateLocalValue,
  ]);

  const prevValue = usePrevious(value);
  const valueChanged =
    value?.[0]?.valueOf() != prevValue?.[0]?.valueOf() ||
    value?.[1]?.valueOf() != prevValue?.[1]?.valueOf();
  useEffect(() => {
    if (valueChanged) {
      handleUpdateLocalValue(value);
    }
  }, [valueChanged, value, handleUpdateLocalValue]);

  const handleSetStartValue = useCallback(
    (newValue) => {
      handleUpdateLocalValue((localValue) => [newValue, localValue?.[1]]);
    },
    [handleUpdateLocalValue],
  );

  const handleSetEndValue = useCallback(
    (newValue) => {
      handleUpdateLocalValue((localValue) => [localValue?.[0], newValue]);
    },
    [handleUpdateLocalValue],
  );

  return (
    <div className={s.root}>
      <DateRangeValuePopover
        value={startValue}
        onChange={(value) => {
          handleSetStartValue(value);
          setStartText(value?.format(DATE_TIME_FORMAT) ?? '');
        }}
        isVisible={startPopoverVisible}
        onVisibleChange={setStartPopoverVisible}
        isDateDisabled={(toCheck) => {
          return endValue != null && toCheck.isAfter(endValue);
        }}
        isDateInRange={(toCheck) => ({
          isStart: startValue != null && toCheck.isSame(startValue, 'day'),
          isEnd: endValue != null && toCheck.isSame(endValue, 'day'),
          inRange:
            startValue != null &&
            toCheck.isAfter(startValue) &&
            endValue != null &&
            toCheck.isBefore(endValue),
        })}
        allowClear={allowClear[0] ?? true}
        clearNotAllowedTooltip={clearNotAllowedTooltip}
      >
        <DateTimeTextInput
          placeholder={'Start date'}
          value={startText}
          onChange={setStartText}
          onChangeDate={handleSetStartValue}
          onFocus={() => {
            setStartPopoverVisible(true);
            setEndPopoverVisible(false);
          }}
          onBlur={() => {
            setStartText(localValue?.[0]?.format(DATE_TIME_FORMAT) ?? '');
          }}
        />
      </DateRangeValuePopover>
      <ArrowRightLineIcon className={s.separator} />
      <DateRangeValuePopover
        value={endValue}
        onChange={(value) => {
          handleSetEndValue(value);
          setEndText(value?.format(DATE_TIME_FORMAT) ?? '');
        }}
        isVisible={endPopoverVisible}
        onVisibleChange={setEndPopoverVisible}
        isDateDisabled={(toCheck) => {
          return startValue != null && toCheck.isBefore(startValue);
        }}
        isDateInRange={(toCheck) => ({
          isStart: startValue != null && toCheck.isSame(startValue, 'day'),
          isEnd: endValue != null && toCheck.isSame(endValue, 'day'),
          inRange:
            startValue != null &&
            toCheck.isAfter(startValue) &&
            endValue != null &&
            toCheck.isBefore(endValue),
        })}
        allowClear={allowClear[1] ?? true}
        clearNotAllowedTooltip={clearNotAllowedTooltip}
      >
        <DateTimeTextInput
          placeholder={'End date'}
          value={endText}
          onChange={setEndText}
          onChangeDate={handleSetEndValue}
          onFocus={() => {
            setStartPopoverVisible(false);
            setEndPopoverVisible(true);
          }}
          onBlur={() => {
            setEndText(localValue?.[1]?.format(DATE_TIME_FORMAT) ?? '');
          }}
        />
      </DateRangeValuePopover>
    </div>
  );
}
