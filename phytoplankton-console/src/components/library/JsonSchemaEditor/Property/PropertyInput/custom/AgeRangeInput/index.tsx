import React, { useCallback, useEffect, useState } from 'react';
import s from './style.module.less';
import Label from '@/components/library/Label';
import Slider from '@/components/library/Slider';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';
import { UiSchemaAgeRange } from '@/components/library/JsonSchemaEditor/types';
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

const DEFAULT_GRANULARITY = 'year';

const GRANULARITY_RANGE = {
  year: [0, 100],
  day: [0, 365],
  month: [0, 24],
} as const;

function getGranularityRange(granularity?: string): [number, number] {
  return (
    GRANULARITY_RANGE[granularity ?? DEFAULT_GRANULARITY] ?? GRANULARITY_RANGE[DEFAULT_GRANULARITY]
  );
}

interface Props extends InputProps<ValueType> {
  uiSchema?: UiSchemaAgeRange;
}

export default function AgeRangeInput(props: Props) {
  const { value, onChange, uiSchema, ...rest } = props;
  const defaultGranularity: string = uiSchema?.['ui:defaultGranularity'] ?? DEFAULT_GRANULARITY;
  const minGranularity = value?.minAge?.granularity;
  const maxGranularity = value?.maxAge?.granularity;
  const granularityValue = minGranularity ?? maxGranularity ?? defaultGranularity;

  const [from, to] = getGranularityRange(granularityValue);
  const minValue = value?.minAge?.units;
  const maxValue = value?.maxAge?.units;

  const [ageInput, setAgeInput] = useState<number | undefined>(0);

  const handleChange = useCallback(
    (newValue: ValueType | undefined) => {
      onChange?.(newValue?.minAge == null && newValue?.maxAge == null ? undefined : newValue);
    },
    [onChange],
  );
  useEffect(() => {
    setAgeInput(minValue);
  }, [minValue]);

  return (
    <div className={s.root}>
      <Label label={'Min age'} level={2}>
        <NumberInput
          testName="min-age-input"
          min={0}
          max={maxValue ?? to}
          allowClear={true}
          value={minValue}
          onChange={(newValue) => {
            setAgeInput(newValue);
          }}
          onBlur={() => {
            handleChange({
              ...value,
              minAge:
                ageInput != undefined
                  ? {
                      units: ageInput,
                      granularity: granularityValue,
                    }
                  : undefined,
            });
          }}
          onFocus={() => {
            if (ageInput === undefined) setAgeInput(0);
          }}
          {...rest}
        />
      </Label>
      <Slider
        data-cy="age-range-slider"
        mode="RANGE"
        min={from}
        max={to}
        step={1}
        value={value != null ? [value.minAge?.units ?? from, value.maxAge?.units ?? to] : undefined}
        onChange={(newValue) => {
          if (newValue == null) {
            onChange?.(undefined);
            return;
          }
          const [newMin, newMax] = newValue;

          handleChange({
            minAge:
              minValue == null && newMin === from
                ? undefined
                : {
                    units: newMin,
                    granularity: granularityValue,
                  },
            maxAge:
              maxValue == null && newMax === to
                ? undefined
                : {
                    units: newMax,
                    granularity: granularityValue,
                  },
          });
        }}
        {...rest}
      />
      <Label label={'Max age'} level={2}>
        <NumberInput
          testName="max-age-input"
          min={minValue ?? from}
          max={to}
          value={maxValue}
          allowClear={true}
          onChange={(newValue) => {
            setAgeInput(newValue);
          }}
          onBlur={() => {
            handleChange({
              ...value,
              maxAge:
                ageInput != null
                  ? {
                      units: ageInput,
                      granularity: granularityValue,
                    }
                  : undefined,
            });
          }}
        />
      </Label>
      <Label label={''} level={2} testId="granularity-select">
        <Select
          mode="SINGLE"
          value={granularityValue}
          options={[
            { value: 'day', label: 'days' },
            { value: 'month', label: 'months' },
            { value: 'year', label: 'years' },
          ]}
          onChange={(newGranularity) => {
            const [from, to] = getGranularityRange(newGranularity);

            handleChange({
              minAge:
                minValue != null
                  ? {
                      units: Math.min(Math.max(minValue, from), to),
                      granularity: newGranularity,
                    }
                  : undefined,
              maxAge:
                maxValue != null
                  ? {
                      units: Math.max(Math.min(maxValue, to), from),
                      granularity: newGranularity,
                    }
                  : undefined,
            });
          }}
        />
      </Label>
    </div>
  );
}
