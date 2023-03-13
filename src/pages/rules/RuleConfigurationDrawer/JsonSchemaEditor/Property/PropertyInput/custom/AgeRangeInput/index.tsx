import React from 'react';
import s from './style.module.less';
import Label from '@/components/library/Label';
import Slider from '@/components/ui/Slider';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import { UiSchemaAgeRange } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/types';
import Select from '@/components/library/Select';

type ValueType = {
  minAge?: {
    granularity?: string;
    units?: number;
  };
  maxAge?: {
    granularity?: string;
    units?: number;
  };
};

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaAgeRange;
}

const MIN_AGE = 0;
const MAX_AGE = 100;

export default function AgeRangeInput(props: Props) {
  const { value, onChange, uiSchema, ...rest } = props;
  const defaultGranularity: string = uiSchema?.['ui:defaultGranularity'] ?? 'year';
  const minValue = value?.minAge?.units;
  const maxValue = value?.maxAge?.units;
  const minGranularity = value?.minAge?.granularity;
  const maxGranularity = value?.minAge?.granularity;
  let granularityValue = defaultGranularity;
  if (minGranularity && maxGranularity && minGranularity === maxGranularity) {
    granularityValue = minGranularity;
  }
  return (
    <div className={s.root}>
      <Label label={'Min age'} level={2}>
        <NumberInput
          min={0}
          max={maxValue ?? MAX_AGE}
          value={minValue ?? MIN_AGE}
          onChange={(newValue) => {
            onChange?.({
              ...value,
              minAge: {
                units: newValue,
                granularity: granularityValue,
              },
            });
          }}
          {...rest}
        />
      </Label>
      <Slider
        range={true}
        min={MIN_AGE}
        max={MAX_AGE}
        step={1}
        value={[value?.minAge?.units ?? MIN_AGE, value?.maxAge?.units ?? MAX_AGE]}
        onChange={([min, max]) => {
          onChange?.({
            minAge: {
              units: min,
              granularity: granularityValue,
            },
            maxAge: {
              units: max,
              granularity: granularityValue,
            },
          });
        }}
        {...rest}
      />
      <Label label={'Max age'} level={2}>
        <NumberInput
          min={minValue ?? MIN_AGE}
          max={MAX_AGE}
          value={maxValue ?? MAX_AGE}
          onChange={(newValue) => {
            onChange?.({
              ...value,
              maxAge: {
                units: newValue,
                granularity: granularityValue,
              },
            });
          }}
        />
      </Label>
      <Label label={''} level={2}>
        <Select
          mode="SINGLE"
          value={granularityValue}
          options={[
            { value: 'day', label: 'days' },
            { value: 'month', label: 'months' },
            { value: 'year', label: 'years' },
          ]}
          onChange={(newGranularity) => {
            onChange?.({
              minAge: {
                units: minValue,
                granularity: newGranularity,
              },
              maxAge: {
                units: maxValue,
                granularity: newGranularity,
              },
            });
          }}
        />
      </Label>
    </div>
  );
}
