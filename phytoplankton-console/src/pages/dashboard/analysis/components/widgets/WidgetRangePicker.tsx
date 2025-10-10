import React from 'react';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import { InputProps } from '@/components/library/Form';

export type Value = {
  startTimestamp?: number;
  endTimestamp?: number;
};

interface WidgetRangePickerParams extends InputProps<Value> {}

export default function WidgetRangePicker(props: WidgetRangePickerParams) {
  const { value = {}, onChange } = props;
  const { startTimestamp, endTimestamp } = value;

  return (
    <DatePicker.RangePicker
      value={[
        startTimestamp ? dayjs(startTimestamp) : null,
        endTimestamp ? dayjs(endTimestamp) : null,
      ]}
      onChange={(e) => {
        const [start, end] = e ?? [];
        if (start == null && end == null) {
          onChange?.(undefined);
        } else {
          onChange?.({
            startTimestamp: start?.startOf('day').valueOf(),
            endTimestamp: end?.endOf('day').valueOf(),
          });
        }
      }}
    />
  );
}
