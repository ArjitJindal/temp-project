import React from 'react';
import s from './index.module.less';
import {
  RuleAggregationVariableTimeWindow,
  RuleAggregationTimeWindow,
  RuleAggregationTimeWindowGranularity,
} from '@/apis';
import { InputProps } from '@/components/library/Form';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import { humanizeAuto } from '@/utils/humanize';
import Select from '@/components/library/Select';
import { RULE_AGGREGATION_TIME_WINDOW_GRANULARITYS } from '@/apis/models-custom/RuleAggregationTimeWindowGranularity';
import Checkbox from '@/components/library/Checkbox';

interface Props extends InputProps<RuleAggregationVariableTimeWindow> {}

const DEFAULT_TIME_WINDOW_VALUE: RuleAggregationTimeWindow = {
  units: 1,
  granularity: 'year',
};

const DEFAULT_VALUE: RuleAggregationVariableTimeWindow = {
  start: DEFAULT_TIME_WINDOW_VALUE,
  end: DEFAULT_TIME_WINDOW_VALUE,
};

const FISCAL_YEAR_OPTIONS = [
  { value: 'default', label: '1st January - 31st December' },
  { value: 'indian', label: '1st April - 31st March' },
];

const FISCAL_YEAR_MAPPING: { [type: string]: { startMonth: number; startDay: number } } = {
  default: { startMonth: 1, startDay: 1 },
  indian: { startMonth: 4, startDay: 1 },
};

export default function VariableTimeWindow(props: Props) {
  const { value = DEFAULT_VALUE, onChange } = props;
  const start = value?.start;
  const end = value?.end;
  const isFiscalYear =
    start?.granularity === 'fiscal_year' || end?.granularity === 'fiscal_year' || false;
  const fiscalYearSelectValue =
    FISCAL_YEAR_OPTIONS.find((x) => {
      const xFiscalYear = FISCAL_YEAR_MAPPING[x.value];
      return (
        (xFiscalYear.startDay === start.fiscalYear?.startDay &&
          xFiscalYear.startMonth === start.fiscalYear?.startMonth) ||
        (xFiscalYear.startDay === end.fiscalYear?.startDay &&
          xFiscalYear.startMonth === end.fiscalYear?.startMonth)
      );
    })?.value ?? undefined;

  return (
    <div className={s.root}>
      <div className={s.timeInputs}>
        <Label label={'Time from'} level={2}>
          <UnitGranularityInputs
            fiscalYearSelectValue={fiscalYearSelectValue}
            value={start}
            onChange={(newValue) => {
              if (newValue) {
                onChange?.({
                  ...value,
                  start: newValue,
                });
              }
            }}
          />
        </Label>
        <Label label={'Time to'} level={2}>
          <UnitGranularityInputs
            fiscalYearSelectValue={fiscalYearSelectValue}
            value={end}
            onChange={(newValue) => {
              if (newValue) {
                onChange?.({
                  ...value,
                  end: newValue,
                });
              }
            }}
          />
        </Label>
      </div>
      {isFiscalYear && (
        <Label label={'Fiscal year'} level={2}>
          <Select
            value={fiscalYearSelectValue ?? 'default'}
            onChange={(newValue) => {
              if (newValue != null) {
                const fiscalYear = FISCAL_YEAR_MAPPING[newValue];
                onChange?.({
                  ...value,
                  end:
                    value.end?.granularity === 'fiscal_year'
                      ? {
                          ...value.end,
                          fiscalYear,
                        }
                      : value?.end,
                  start:
                    value.start?.granularity === 'fiscal_year'
                      ? {
                          ...value.start,
                          fiscalYear,
                        }
                      : value.start,
                });
              }
            }}
            mode="SINGLE"
            options={FISCAL_YEAR_OPTIONS}
          />
        </Label>
      )}
      <Label label={'Rolling basis'} level={2} position="RIGHT">
        <Checkbox
          value={
            start?.rollingBasis !== end?.rollingBasis
              ? undefined
              : start?.rollingBasis || end?.rollingBasis || false
          }
          onChange={(newValue) => {
            if (newValue != null) {
              onChange?.({
                ...value,
                end: {
                  ...end,
                  rollingBasis: newValue,
                },
                start: {
                  ...start,
                  rollingBasis: newValue,
                },
              });
            }
          }}
        />
      </Label>
    </div>
  );
}

function UnitGranularityInputs(
  props: InputProps<RuleAggregationTimeWindow> & {
    fiscalYearSelectValue: string | undefined;
  },
) {
  const { fiscalYearSelectValue, isDisabled, value, onChange } = props;
  return (
    <div className={s.unitGranularityInputs}>
      <NumberInput
        isDisabled={isDisabled}
        min={0}
        value={isDisabled ? undefined : value?.units}
        onChange={(newUnits) => {
          onChange?.(
            newUnits != null
              ? {
                  ...DEFAULT_TIME_WINDOW_VALUE,
                  ...value,
                  units: newUnits,
                }
              : undefined,
          );
        }}
      />
      <Select<RuleAggregationTimeWindowGranularity>
        isDisabled={isDisabled}
        value={isDisabled ? undefined : value?.granularity}
        onChange={(newValue) => {
          let fiscalYear: { startMonth: number; startDay: number } | undefined;
          if (newValue === 'fiscal_year') {
            fiscalYear = FISCAL_YEAR_MAPPING[fiscalYearSelectValue ?? 'default'];
          } else {
            fiscalYear = undefined;
          }
          onChange?.(
            newValue != null
              ? {
                  ...DEFAULT_TIME_WINDOW_VALUE,
                  ...value,
                  granularity: newValue,
                  fiscalYear: fiscalYear,
                }
              : undefined,
          );
        }}
        mode="SINGLE"
        options={RULE_AGGREGATION_TIME_WINDOW_GRANULARITYS.map((granularity) => ({
          label: humanizeAuto(granularity),
          value: granularity,
        }))}
      />
    </div>
  );
}
