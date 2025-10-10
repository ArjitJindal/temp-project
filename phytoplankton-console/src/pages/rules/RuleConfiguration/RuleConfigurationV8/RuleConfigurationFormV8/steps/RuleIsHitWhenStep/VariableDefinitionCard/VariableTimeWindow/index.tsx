import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import {
  LogicAggregationVariableTimeWindow,
  LogicAggregationTimeWindow,
  LogicAggregationTimeWindowGranularity,
} from '@/apis';
import { InputProps } from '@/components/library/Form';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import Select from '@/components/library/Select';
import { LOGIC_AGGREGATION_TIME_WINDOW_GRANULARITYS } from '@/apis/models-custom/LogicAggregationTimeWindowGranularity';
import Checkbox from '@/components/library/Checkbox';
import { Hint } from '@/components/library/Form/InputField';

interface Props extends InputProps<LogicAggregationVariableTimeWindow> {}

export const NO_ROLLING_BASIS_GRANULARITIES: LogicAggregationTimeWindowGranularity[] = [
  'second',
  'minute',
  'hour',
];

const DEFAULT_TIME_WINDOW_VALUE: LogicAggregationTimeWindow = {
  units: 1,
  granularity: 'year',
};

const DEFAULT_VALUE: LogicAggregationVariableTimeWindow = {
  start: DEFAULT_TIME_WINDOW_VALUE,
  end: DEFAULT_TIME_WINDOW_VALUE,
};

const FISCAL_YEAR_OPTIONS = [
  { value: 'default', label: '1st January - 31st December' },
  { value: 'indian', label: '1st April - 31st March' },
];

const granularityOptions = LOGIC_AGGREGATION_TIME_WINDOW_GRANULARITYS.map((granularity) => ({
  label: `${granularity === 'now' ? 'now' : humanizeAuto(granularity)} ${
    granularity === 'now' || granularity === 'all_time' ? '' : 'ago'
  }`,
  value: granularity,
}));

const FISCAL_YEAR_MAPPING: { [type: string]: { startMonth: number; startDay: number } } = {
  default: { startMonth: 1, startDay: 1 },
  indian: { startMonth: 4, startDay: 1 },
};

export default function VariableTimeWindow(props: Props) {
  const { value = DEFAULT_VALUE, onChange, isDisabled } = props;
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
        <Label label={'Time from'} required={{ value: true, showHint: !isDisabled }}>
          <UnitGranularityInputs
            isDisabled={isDisabled}
            fiscalYearSelectValue={fiscalYearSelectValue}
            value={end}
            isFrom
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
        <Label label={'Time to'} required={{ value: true, showHint: !isDisabled }}>
          <UnitGranularityInputs
            isDisabled={isDisabled}
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
          <Hint isError={false}>
            {start.granularity === 'all_time'
              ? 'All time starts the time window from 5 years ago'
              : ''}
          </Hint>
        </Label>
      </div>
      {isFiscalYear && (
        <Label label={'Fiscal year'} level={2}>
          <Select
            isDisabled={isDisabled}
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

      {start.granularity !== 'all_time' &&
        !NO_ROLLING_BASIS_GRANULARITIES.includes(start.granularity) &&
        !NO_ROLLING_BASIS_GRANULARITIES.includes(end.granularity) && (
          <Label
            label={'Rolling basis'}
            level={2}
            position="RIGHT"
            hint="With rolling basis, the time window looks back from the hit time by ‘N’ units. Without it, the window starts at the beginning of the selected unit and runs up to the hit time"
          >
            <Checkbox
              isDisabled={isDisabled}
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
        )}
    </div>
  );
}

function UnitGranularityInputs(
  props: InputProps<LogicAggregationTimeWindow> & {
    fiscalYearSelectValue: string | undefined;
    isFrom?: boolean;
  },
) {
  const { fiscalYearSelectValue, isDisabled, value, onChange, isFrom } = props;
  return (
    <div className={s.unitGranularityInputs}>
      {value?.granularity && value?.granularity !== 'now' && value?.granularity !== 'all_time' && (
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
                    units: Math.round(newUnits),
                  }
                : undefined,
            );
          }}
        />
      )}
      <Select<LogicAggregationTimeWindowGranularity>
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
                  units: (newValue === 'all_time' || newValue === 'now' ? 0 : value?.units) ?? 0,
                  granularity: newValue,
                  fiscalYear: fiscalYear,
                }
              : undefined,
          );
        }}
        mode="SINGLE"
        options={granularityOptions.filter((x) =>
          isFrom ? x.value !== 'all_time' : x.value !== 'now',
        )}
      />
    </div>
  );
}
