import React from 'react';
import s from './styles.module.less';
import Select, { Option } from '@/components/library/Select';
import NumberInput from '@/components/library/NumberInput';
import { SLATimeWindow } from '@/apis';
interface Props {
  value: SLATimeWindow | undefined;
  onChange: (value: SLATimeWindow | undefined) => void;
}
const defaultValue: SLATimeWindow = {
  units: 1,
  granularity: 'hours',
};

const timeOptions: Option<SLATimeWindow['granularity']>[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];
function TimeInput(props: Props) {
  return (
    <>
      <div className={s.timeInput}>
        <>
          <NumberInput
            value={props.value?.units}
            onChange={(value) => {
              props.onChange({ ...(props.value ?? defaultValue), units: value ?? 0 });
            }}
          />
          <Select
            mode="SINGLE"
            options={timeOptions}
            value={props.value?.granularity}
            onChange={(value) => {
              props.onChange({ ...(props.value ?? defaultValue), granularity: value ?? 'hours' });
            }}
          />
        </>
      </div>
    </>
  );
}

export default TimeInput;
