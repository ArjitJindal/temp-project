import React, { useCallback } from 'react';
import style from './style.module.less';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';

export type Granularity = 'day' | 'month' | 'year';
export type GranularityExtended = Granularity | 'and above';
const DAY_RANGE_GRANULARITY: Array<{ value: Granularity; label: string }> = [
  { value: 'day', label: 'days' },
  { value: 'month', label: 'months' },
  { value: 'year', label: 'years' },
];
const DAY_RANGE_GRANULARITY_EXTENDED: Array<{ value: GranularityExtended; label: string }> = [
  ...DAY_RANGE_GRANULARITY,
  { value: 'and above', label: 'and above' },
];

export type ValueType = {
  minAge?: {
    granularity?: Granularity;
    units?: number;
  };
  maxAge?: {
    granularity?: GranularityExtended;
    units?: number;
  };
};

const DEFAULT_GRANULARITY: Granularity = 'year';

interface Props extends InputProps<ValueType> {
  defaultGranularity?: Granularity;
}

export default function AgeRangeInput(props: Props) {
  const { value, onChange, defaultGranularity = DEFAULT_GRANULARITY } = props;
  const minAge = value?.minAge;
  const maxAge = value?.maxAge;
  const handleChange = useCallback(
    (newValue: ValueType | undefined) => {
      onChange?.(newValue?.minAge == null && newValue?.maxAge == null ? undefined : newValue);
    },
    [onChange],
  );
  return (
    <div className={style.root}>
      <div className={style.dayRangeRoot}>
        <div className={style.dayRangeContainer}>
          <Label label="From">
            <div className={style.dayRangeInputContainer}>
              <NumberInput
                value={minAge?.units}
                min={0}
                onChange={(val) => {
                  handleChange({
                    ...value,
                    minAge: {
                      units: val,
                      granularity: minAge?.granularity ?? defaultGranularity,
                    },
                  });
                }}
                testName="min-age-input"
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
              />
              <Select
                options={DAY_RANGE_GRANULARITY}
                value={minAge?.granularity}
                style={{ width: 150 }}
                onChange={(val: Granularity | undefined) => {
                  handleChange({
                    ...value,
                    minAge: {
                      ...minAge,
                      granularity: val,
                    },
                  });
                }}
                testId="min-age-select"
              />
            </div>
          </Label>
        </div>
        <div className={style.dayRangeContainer}>
          <Label label="To">
            <div className={style.dayRangeInputContainer}>
              <NumberInput
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
                value={maxAge?.units}
                min={0}
                isDisabled={
                  maxAge?.granularity === 'and above' || maxAge?.granularity === undefined
                }
                onChange={(val) => {
                  handleChange({
                    ...value,
                    maxAge: {
                      units: val,
                      granularity: maxAge?.granularity,
                    },
                  });
                }}
                testName="max-age-input"
              />
              <Select
                onChange={(val: GranularityExtended | undefined) => {
                  handleChange({
                    ...value,
                    maxAge:
                      val === 'and above'
                        ? undefined
                        : {
                            units: maxAge?.units,
                            granularity: val,
                          },
                  });
                }}
                options={DAY_RANGE_GRANULARITY_EXTENDED}
                value={maxAge?.granularity ?? 'and above'}
                style={{ width: 150 }}
                mode="SINGLE"
                testId="max-age-select"
              />
            </div>
          </Label>
        </div>
      </div>
    </div>
  );
}
