import { useEffect } from 'react';
import { keyBy, uniq } from 'lodash';
import { COUNTRIES, COUNTRY_ALIASES, CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { capitalizeWords, humanizeConstant } from '@flagright/lib/utils/humanize';
import { TRANSACTION_TYPES } from '@flagright/lib/utils';
import style from './style.module.less';
import { RiskLevelTableItem, RiskValueContentByType, RiskValueType } from './types';
import SliderWithInputs from './SliderWithInputs';
import { notEmpty } from '@/utils/array';
import {
  CurrencyCode,
  RiskFactorDataType,
  RiskFactorParameter,
  RiskParameterLevelKeyValue,
  RiskParameterValue,
  RiskParameterValueAmountRange,
  RiskParameterValueDayRange,
  RiskParameterValueDayRangeEndGranularityEnum,
  RiskParameterValueDayRangeStartGranularityEnum,
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
  RiskParameterValueTimeRange,
  RiskScoreValueLevel,
  RiskScoreValueScore,
} from '@/apis';
import { businessType, consumerType } from '@/utils/customer-type';
import Select, { Option } from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import NumberInput from '@/components/library/NumberInput';
import { TRANSACTIONS_UNIQUES, USERS_UNIQUES } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { getPaymentMethodTitle, isPaymentMethod, PAYMENT_METHODS } from '@/utils/payments';
import { BUSINESS_USER_SEGMENTS } from '@/apis/models-custom/BusinessUserSegment';
import { CONSUMER_USER_SEGMENTS } from '@/apis/models-custom/ConsumerUserSegment';
import { _3DS_DONE_OPTIONS } from '@/utils/3dsOptions';
import { EMPLOYMENT_STATUSS } from '@/apis/models-custom/EmploymentStatus';
import { SOURCE_OF_FUNDSS } from '@/apis/models-custom/SourceOfFunds';
import { RESIDENCE_TYPES } from '@/utils/residence-types';
import { BOOLEAN_OPTIONS } from '@/utils/booleanOptions';
import { timezones } from '@/utils/timezones';
import TagList from '@/components/library/Tag/TagList';
import Tag from '@/components/library/Tag';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import { isTransactionType } from '@/utils/api/transactions';
import TransactionTypeDisplay from '@/components/library/TransactionTypeDisplay';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { hasOverlaps } from '@/utils/math';
import { convertToDays } from '@/utils/dayjs';
import { getOr } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { useSettingsData } from '@/utils/api/auth';

type InputRendererProps<T extends RiskValueType> = {
  isDisabled?: boolean;
  value?: RiskValueContentByType<T> | null;
  existedValues?: RiskValueContentByType<T>[];
  onChange: (values: RiskValueContentByType<T>) => void;
  setShouldShowNewValueInput: (shouldShow: boolean) => void;
  shouldShowNewValueInput: boolean;
  setOnlyDeleteLast: (onlyDeleteLast: boolean) => void;
};

type Information<T extends RiskValueType> = (params: {
  newParameterName: RiskFactorParameter;
  newValue: RiskValueContentByType<T>;
  newRiskValue: RiskScoreValueLevel | RiskScoreValueScore | null;
  previousValues: RiskParameterLevelKeyValue[];
  defaultCurrency: string | null;
}) => null | string;

type InputRenderer<T extends RiskValueType> = (props: InputRendererProps<T>) => React.ReactNode;

type ValueRenderer<T extends RiskValueType> = (props: {
  value?: RiskValueContentByType<T>;
  onChange?: (newValue?: RiskValueContentByType<T>) => void;
  handleRemoveValue?: (value: string) => void;
}) => React.ReactNode;

type Validation<T extends RiskValueType> = (params: {
  allValues: RiskValueContentByType<T>[];
  newValue: RiskValueContentByType<T> | null;
  previousValues: RiskParameterValue['content'][];
}) => null | string;

type ParameterValuesFormValidations = {
  [K in RiskValueType]?: Validation<K>[];
};

const arrayOptionsGenerator = (values: string[]) => {
  return values.map((value) => ({ value, label: humanizeConstant(value) }));
};

export const BUSINESS_USER_SEGMENT_OPTIONS = arrayOptionsGenerator(BUSINESS_USER_SEGMENTS);
export const CONSUMER_USER_SEGMENT_OPTIONS = arrayOptionsGenerator(CONSUMER_USER_SEGMENTS);
export const CONSUMER_EMPLOYMENT_STATUS_OPTIONS = arrayOptionsGenerator(EMPLOYMENT_STATUSS);
export const SOURCE_OF_FUNDS_OPTIONS = arrayOptionsGenerator(SOURCE_OF_FUNDSS);

const USER_REGISTRATION_STATUS_OPTIONS = [
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'UNREGISTERED', label: 'Unregistered' },
];

function riskValueLiteral(
  content: string | number | boolean | undefined,
): RiskParameterValueLiteral {
  return {
    kind: 'LITERAL',
    content,
  };
}

function riskValueMultiple(values: RiskParameterValueLiteral[]): RiskParameterValueMultiple {
  return {
    kind: 'MULTIPLE',
    values,
  };
}

function riskValueRange(start: number, end: number): RiskParameterValueRange {
  return {
    kind: 'RANGE',
    start,
    end,
  };
}

function riskValueAmountRange(
  start: number,
  end: number,
  currency: CurrencyCode,
): RiskParameterValueAmountRange {
  return {
    kind: 'AMOUNT_RANGE',
    start,
    end,
    currency,
  };
}

function riskValueTimeRange(
  startHour: number,
  endHour: number,
  timezone: string,
): RiskParameterValueTimeRange {
  return {
    kind: 'TIME_RANGE',
    startHour,
    endHour,
    timezone,
  };
}

function riskValueDayRange(
  start: number,
  startGranularity: RiskParameterValueDayRange['startGranularity'],
  end: number,
  endGranularity: RiskParameterValueDayRange['endGranularity'],
): RiskParameterValueDayRange {
  return {
    kind: 'DAY_RANGE',
    start,
    end,
    endGranularity,
    startGranularity,
  };
}

const timeIn24HourFormat = (hour: number | undefined) => {
  if (!hour) {
    return '00:00';
  }
  return `${hour < 10 ? `0${hour}` : hour}:00`;
};

const timeValues = Array.from({ length: 25 }, (_, i) => ({
  value: i,
  label: timeIn24HourFormat(i),
}));

const timeZonesData = timezones.map((name) => ({
  value: name,
  label: name,
}));

const timeZonesDataMap = keyBy(timeZonesData, 'value');

const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DAY_RANGE_GRANULARITY: Option<RiskParameterValueDayRangeStartGranularityEnum>[] = [
  { value: 'DAYS', label: 'days' },
  { value: 'MONTHS', label: 'months' },
  { value: 'YEARS', label: 'years' },
];

const EXTENDED_DAY_RANGE_GRANULARITY: Option<RiskParameterValueDayRangeEndGranularityEnum>[] = [
  ...DAY_RANGE_GRANULARITY,
  { value: 'INFINITE', label: 'and above' },
];

const MultipleSelect: React.FC<
  InputRendererProps<'MULTIPLE'> & {
    options: Array<{ value: string; label: string; alternativeLabels?: string[] }>;
    mode?: 'MULTIPLE' | 'MULTIPLE_DYNAMIC';
  }
> = (props) => {
  const { value, isDisabled, onChange, options, existedValues = [], mode = 'MULTIPLE' } = props;
  const disabledOptions: string[] = existedValues.flatMap((x) =>
    x.values.map((y) => `${y.content}`),
  );
  const optionsFixed = options.map((x) => ({
    ...x,
    isDisabled: disabledOptions.includes(x.value),
  }));
  return (
    <Select<string>
      value={value?.values.map(({ content }) => `${content}`) ?? []}
      onChange={(value) => {
        onChange(riskValueMultiple((value ?? []).map((x) => riskValueLiteral(x))));
      }}
      isDisabled={isDisabled}
      options={optionsFixed}
      mode={mode}
    />
  );
};

const SingleSelect: React.FC<
  InputRendererProps<'LITERAL'> & {
    options: Array<{ value: RiskParameterValueLiteral['content']; label: string }>;
  }
> = (props) => {
  const { value, isDisabled, onChange, options, existedValues = [] } = props;
  const disabledOptions: RiskParameterValueLiteral['content'][] = existedValues.map(
    (x) => x.content,
  );

  return (
    <Select<RiskParameterValueLiteral['content']>
      value={value?.content ?? ''}
      onChange={(value) => {
        onChange(riskValueLiteral(value));
      }}
      isDisabled={isDisabled}
      mode="SINGLE"
      options={options.map((x) => ({ ...x, isDisabled: disabledOptions.includes(x.value) }))}
    />
  );
};

const DEFAULT_STRING_RENDERER: ValueRenderer<'LITERAL'> = ({ value }) => (
  <span>{value?.content ?? ''}</span>
);

const DEFAULT_MULTIPLE_RENDERER: ValueRenderer<'MULTIPLE'> = ({ value }) => {
  if (value == null) {
    return null;
  }
  return (
    <span>
      {value.values
        .map((item) => item.content)
        .filter((x) => !!x)
        .join(', ')}
    </span>
  );
};

const DEFAULT_RANGE_RENDERER: ValueRenderer<'RANGE'> = ({ value, onChange }) => {
  if (value == null) {
    return null;
  }
  const marks = {};
  if (value.start != null) {
    marks[value.start] = value.start;
  }
  if (value.end != null) {
    marks[value.end] = value.end;
  }
  return (
    <SliderWithInputs
      value={{
        start: value.start ?? 0,
        end: value.end ?? 0,
      }}
      onChange={
        onChange
          ? (newValue) => {
              const newRangeValue: RiskParameterValueRange = {
                kind: 'RANGE',
                ...newValue,
              };
              onChange(newRangeValue);
            }
          : undefined
      }
    />
  );
};

const DEFAULT_DAY_RANGE_RENDERER: ValueRenderer<'DAY_RANGE'> = ({ value, onChange }) => {
  if (value == null) {
    return null;
  }

  return (
    <div className={style.dayRangeRoot}>
      <div className={style.dayRangeContainer}>
        <Label label="From">
          <div className={style.dayRangeInputContainer}>
            <NumberInput
              isDisabled={onChange == null}
              htmlAttrs={{ type: 'number', style: { width: 100 } }}
              value={value.start}
              onChange={(newValue) => {
                if (onChange && newValue) {
                  onChange({
                    ...value,
                    kind: 'DAY_RANGE',
                    start: newValue,
                  });
                }
              }}
            />
            <Select<RiskParameterValueDayRangeStartGranularityEnum>
              isDisabled={onChange == null}
              value={value.startGranularity}
              options={DAY_RANGE_GRANULARITY}
              onChange={(newValue) => {
                if (onChange && newValue) {
                  onChange({
                    ...value,
                    kind: 'DAY_RANGE',
                    startGranularity: newValue,
                  });
                }
              }}
            />
          </div>
        </Label>
      </div>
      <div className={style.dayRangeContainer}>
        <Label label="To">
          <div className={style.dayRangeInputContainer}>
            <NumberInput
              isDisabled={onChange == null}
              htmlAttrs={{ type: 'number', style: { width: 100 } }}
              value={value.endGranularity === 'INFINITE' ? undefined : value.end}
              onChange={(newValue) => {
                if (onChange && newValue) {
                  onChange({
                    ...value,
                    kind: 'DAY_RANGE',
                    end: newValue,
                  });
                }
              }}
            />
            <div style={{ width: 150 }}>
              <Select<RiskParameterValueDayRangeEndGranularityEnum>
                isDisabled={onChange == null}
                value={value.endGranularity}
                options={EXTENDED_DAY_RANGE_GRANULARITY}
                onChange={(newValue) => {
                  if (onChange && newValue) {
                    onChange({
                      ...value,
                      kind: 'DAY_RANGE',
                      endGranularity: newValue,
                    });
                  }
                }}
              />
            </div>
          </div>
        </Label>
      </div>
    </div>
  );
};

export const INPUT_RENDERERS: { [key in RiskFactorDataType]: InputRenderer<any> } = {
  STRING: (({ isDisabled, value, onChange }) => (
    <TextInput
      isDisabled={isDisabled}
      value={`${value?.content ?? ''}`}
      onChange={(val) => onChange(riskValueLiteral(val))}
    />
  )) as InputRenderer<'LITERAL'>,
  COUNTRY: ((props) => {
    return (
      <MultipleSelect
        options={Object.entries(COUNTRIES).map(([countryCode, name]) => ({
          value: countryCode,
          label: name,
          alternativeLabels: COUNTRY_ALIASES[countryCode] ?? [],
        }))}
        {...props}
      />
    );
  }) as InputRenderer<'MULTIPLE'>,
  BUSINESS_INDUSTRY: ((props) => {
    const api = useApi();
    const result = useQuery(USERS_UNIQUES('BUSINESS_INDUSTRY'), () =>
      api.getUsersUniques({
        field: 'BUSINESS_INDUSTRY',
      }),
    );
    return (
      <MultipleSelect
        options={getOr(result.data, []).map((entry) => ({
          value: entry,
          label: entry,
        }))}
        mode="MULTIPLE_DYNAMIC"
        {...props}
      />
    );
  }) as InputRenderer<'MULTIPLE'>,
  BANK_NAMES: ((props) => {
    const api = useApi();
    const result = useQuery(TRANSACTIONS_UNIQUES('BANK_NAMES'), () =>
      api.getTransactionsUniques({
        field: 'BANK_NAMES',
      }),
    );
    return (
      <MultipleSelect
        options={getOr(result.data, []).map((entry) => ({
          value: entry,
          label: entry,
        }))}
        mode="MULTIPLE_DYNAMIC"
        {...props}
      />
    );
  }) as InputRenderer<'MULTIPLE'>,
  CURRENCY: ((props) => {
    return <MultipleSelect options={CURRENCIES_SELECT_OPTIONS} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  CONSUMER_USER_TYPE: ((props) => {
    return <MultipleSelect options={consumerType} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  BUSINESS_USER_TYPE: ((props) => {
    return <MultipleSelect options={businessType} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  BUSINESS_USER_SEGMENT: ((props) => {
    return <MultipleSelect options={BUSINESS_USER_SEGMENT_OPTIONS} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  CONSUMER_USER_SEGMENT: ((props) => {
    return <MultipleSelect options={CONSUMER_USER_SEGMENT_OPTIONS} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  CONSUMER_EMPLOYMENT_STATUS: ((props) => {
    return <MultipleSelect options={CONSUMER_EMPLOYMENT_STATUS_OPTIONS} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  USER_REGISTRATION_STATUS: ((props) => {
    return <MultipleSelect options={USER_REGISTRATION_STATUS_OPTIONS} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  PAYMENT_METHOD: ((props) => {
    return (
      <MultipleSelect
        options={PAYMENT_METHODS.map((method) => ({
          value: method,
          label: getPaymentMethodTitle(method),
        }))}
        {...props}
      />
    );
  }) as InputRenderer<'MULTIPLE'>,
  TRANSACTION_TYPES: ((props) => {
    return (
      <MultipleSelect
        mode="MULTIPLE_DYNAMIC"
        options={TRANSACTION_TYPES.map((type) => ({ value: type, label: capitalizeWords(type) }))}
        {...props}
      />
    );
  }) as InputRenderer<'MULTIPLE'>,
  RESIDENCE_TYPES: ((props) => {
    return (
      <MultipleSelect
        options={RESIDENCE_TYPES.map((type) => ({ value: type, label: capitalizeWords(type) }))}
        {...props}
      />
    );
  }) as InputRenderer<'MULTIPLE'>,
  RANGE: (({ isDisabled, value, onChange }) => {
    return (
      <SliderWithInputs
        value={
          value
            ? {
                start: value.start ?? 0,
                end: value.end ?? 0,
              }
            : undefined
        }
        isDisabled={isDisabled}
        onChange={(value) => {
          if (value != null) {
            onChange(riskValueRange(value.start, value.end));
          }
        }}
      />
    );
  }) as InputRenderer<'RANGE'>,
  DAY_RANGE: (({
    isDisabled,
    onChange,
    shouldShowNewValueInput,
    setShouldShowNewValueInput,
    value,
    existedValues,
    setOnlyDeleteLast,
  }) => {
    const length = existedValues?.length;
    const previousEndGranularity = !length ? 'DAYS' : existedValues[length - 1]?.endGranularity;
    const previousEnd = !length ? 0 : existedValues[length - 1]?.end;
    const startValue = length ? previousEnd : 0;

    useEffect(() => {
      if (length && existedValues[length - 1]?.endGranularity === 'INFINITE') {
        setShouldShowNewValueInput(false);
      } else {
        setShouldShowNewValueInput(true);
      }
    }, [existedValues, setShouldShowNewValueInput, length]);

    useEffect(() => {
      setOnlyDeleteLast(true);
    }, [setOnlyDeleteLast]);

    return shouldShowNewValueInput ? (
      <div className={style.dayRangeRoot}>
        <div className={style.dayRangeContainer}>
          <Label label="From">
            <div className={style.dayRangeInputContainer}>
              <NumberInput
                isDisabled={true}
                value={previousEnd}
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
              />
              <div style={{ width: 150 }}>
                <Select
                  isDisabled={true}
                  options={DAY_RANGE_GRANULARITY}
                  value={previousEndGranularity}
                />
              </div>
            </div>
          </Label>
        </div>

        <div className={style.dayRangeContainer}>
          <Label label="To">
            <div className={style.dayRangeInputContainer}>
              <NumberInput
                isDisabled={isDisabled || value?.endGranularity === 'INFINITE'}
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
                value={value?.endGranularity === 'INFINITE' ? undefined : value?.end}
                onChange={(val) => {
                  onChange(
                    riskValueDayRange(
                      startValue,
                      previousEndGranularity as RiskParameterValueDayRangeStartGranularityEnum,
                      value?.endGranularity === 'INFINITE' || !val ? 0 : val,
                      value?.endGranularity ?? previousEndGranularity,
                    ),
                  );
                }}
              />
              <div style={{ width: 150 }}>
                <Select
                  isDisabled={isDisabled}
                  onChange={(val) => {
                    onChange(
                      riskValueDayRange(
                        startValue,
                        previousEndGranularity as RiskParameterValueDayRangeStartGranularityEnum,
                        value?.end ?? 0,
                        val as RiskParameterValueDayRangeEndGranularityEnum,
                      ),
                    );
                  }}
                  options={EXTENDED_DAY_RANGE_GRANULARITY}
                  value={value?.endGranularity ?? previousEndGranularity}
                  mode="SINGLE"
                />
              </div>
            </div>
          </Label>
        </div>
      </div>
    ) : null;
  }) as InputRenderer<'DAY_RANGE'>,
  TIME_RANGE: (({ isDisabled, value, onChange }) => {
    return (
      <div style={{ display: 'grid', gridAutoFlow: 'column', gap: '.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Label label="Start Time">
            <Select
              isDisabled={isDisabled}
              onChange={(val) =>
                onChange(
                  riskValueTimeRange(
                    val ?? 0,
                    value?.endHour ?? 0,
                    value?.timezone ?? currentTimeZone,
                  ),
                )
              }
              options={timeValues}
              value={value?.startHour ?? 0}
            />
          </Label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Label label="End Time">
            <Select<number>
              isDisabled={isDisabled}
              onChange={(val) =>
                onChange(
                  riskValueTimeRange(
                    value?.startHour ?? 0,
                    val ?? 0,
                    value?.timezone ?? currentTimeZone,
                  ),
                )
              }
              options={timeValues}
              value={value?.endHour ?? 0}
            />
          </Label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Label label="Time Zone">
            <Select
              isDisabled={isDisabled}
              onChange={(val) =>
                onChange(
                  riskValueTimeRange(
                    value?.startHour ?? 0,
                    value?.endHour ?? 0,
                    val ?? currentTimeZone,
                  ),
                )
              }
              options={timeZonesData}
              value={value?.timezone ?? currentTimeZone}
            />
          </Label>
        </div>
      </div>
    );
  }) as InputRenderer<'TIME_RANGE'>,
  CARD_3DS_STATUS: ((props) => {
    return <SingleSelect options={_3DS_DONE_OPTIONS} {...props} />;
  }) as InputRenderer<'LITERAL'>,
  BOOLEAN: ((props) => {
    return <SingleSelect options={BOOLEAN_OPTIONS} {...props} />;
  }) as InputRenderer<'LITERAL'>,
  SOURCE_OF_FUNDS: ((props) => {
    return <MultipleSelect options={SOURCE_OF_FUNDS_OPTIONS} {...props} />;
  }) as InputRenderer<'MULTIPLE'>,
  AMOUNT_RANGE: ((props) => {
    const queryData = useSettingsData();
    const defaultCurrency =
      props.existedValues?.at(-1)?.currency ??
      getOr(queryData.data, {}).defaultValues?.currency ??
      'USD';
    return (
      <>
        <div className={style.amount_container}>
          <div className={style.amountCurrencyContainer}>
            <Label label={<div className={style.currencyLabel}>Currency</div>}>
              <Select
                isDisabled={props.isDisabled}
                value={props.value?.currency ?? defaultCurrency}
                options={CURRENCIES_SELECT_OPTIONS}
                onChange={(newValue) => {
                  props.onChange(
                    riskValueAmountRange(
                      props.value?.start ?? 0,
                      props.value?.end ?? 0,
                      (newValue ?? defaultCurrency) as CurrencyCode,
                    ),
                  );
                }}
              />
            </Label>
          </div>
          <div className={style.amountRangeLabel}>
            <Label label="From">
              <NumberInput
                isDisabled={props.isDisabled}
                min={0}
                value={props.value?.start ?? 0}
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
                onChange={(value) =>
                  props.onChange(
                    riskValueAmountRange(
                      value ?? 0,
                      props.value?.end ?? 0,
                      props.value?.currency ?? defaultCurrency,
                    ),
                  )
                }
              />
            </Label>
          </div>
          <div className={style.amountRangeLabel}>
            <Label label="To">
              <NumberInput
                isDisabled={props.isDisabled}
                min={0}
                value={props.value?.end ?? 0}
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
                onChange={(value) =>
                  props.onChange(
                    riskValueAmountRange(
                      props.value?.start ?? 0,
                      value ?? 0,
                      props.value?.currency ?? defaultCurrency,
                    ),
                  )
                }
              />
            </Label>
          </div>
        </div>
      </>
    );
  }) as InputRenderer<'AMOUNT_RANGE'>,
};

export const VALUE_RENDERERS: { [key in RiskFactorDataType]: ValueRenderer<any> } = {
  STRING: DEFAULT_STRING_RENDERER,
  CURRENCY: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <span>
        {value.values
          .map(
            (item) =>
              CURRENCIES_SELECT_OPTIONS.find((currency) => currency.value === item.content)?.label,
          )
          .filter((x) => !!x)
          .join(', ')}
      </span>
    );
  }) as ValueRenderer<'MULTIPLE'>,
  COUNTRY: (({ value, handleRemoveValue }) => {
    if (value == null) {
      return null;
    }
    return (
      <TagList>
        {value.values.map((item, index) => (
          <Tag
            actions={
              handleRemoveValue
                ? [
                    {
                      key: 'delete',
                      icon: <CloseLineIcon />,
                      action: () => {
                        const content = item.content;
                        if (handleRemoveValue && typeof content === 'string') {
                          handleRemoveValue(content);
                        }
                      },
                    },
                  ]
                : []
            }
            key={index}
          >
            <CountryDisplay key={`${item.content}`} isoCode={`${item.content}`} />
          </Tag>
        ))}
      </TagList>
    );
  }) as ValueRenderer<'MULTIPLE'>,
  PAYMENT_METHOD: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <>
        {value.values.map((item) => {
          const itemValue = `${item.content}`;
          if (!isPaymentMethod(itemValue)) {
            return <span key={itemValue}>{itemValue}</span>;
          }
          return <PaymentMethodTag key={itemValue} paymentMethod={itemValue} />;
        })}
      </>
    );
  }) as ValueRenderer<'MULTIPLE'>,
  BUSINESS_INDUSTRY: DEFAULT_MULTIPLE_RENDERER,
  BANK_NAMES: DEFAULT_MULTIPLE_RENDERER,
  TRANSACTION_TYPES: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <>
        {value.values.map((item) => {
          const itemValue = `${item.content}`;
          if (!isTransactionType(itemValue)) {
            return <span key={itemValue}>{itemValue}</span>;
          }
          return <TransactionTypeDisplay key={itemValue} transactionType={itemValue} />;
        })}
      </>
    );
  }) as ValueRenderer<'MULTIPLE'>,
  RESIDENCE_TYPES: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <>
        {value.values.map((item) => {
          const itemValue = `${item.content}`;
          return itemValue;
        })}
      </>
    );
  }) as ValueRenderer<'MULTIPLE'>,
  CONSUMER_USER_TYPE: DEFAULT_MULTIPLE_RENDERER,
  BUSINESS_USER_TYPE: DEFAULT_MULTIPLE_RENDERER,
  BUSINESS_USER_SEGMENT: DEFAULT_MULTIPLE_RENDERER,
  CONSUMER_USER_SEGMENT: DEFAULT_MULTIPLE_RENDERER,
  CONSUMER_EMPLOYMENT_STATUS: DEFAULT_MULTIPLE_RENDERER,
  USER_REGISTRATION_STATUS: DEFAULT_MULTIPLE_RENDERER,
  RANGE: DEFAULT_RANGE_RENDERER,
  DAY_RANGE: DEFAULT_DAY_RANGE_RENDERER,
  TIME_RANGE: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <div style={{ display: 'grid', gridAutoFlow: 'column', gap: '.5rem' }}>
        <p style={{ marginBottom: 0 }}>
          {timeIn24HourFormat(value?.startHour)} - {timeIn24HourFormat(value?.endHour)}{' '}
          {`(${timeZonesDataMap[value?.timezone]?.label})`}
        </p>
      </div>
    );
  }) as ValueRenderer<'TIME_RANGE'>,
  CARD_3DS_STATUS: (({ value }) => {
    return (
      <span>{value?.content === true ? 'Yes' : value?.content === false ? 'No' : 'Unknown'}</span>
    );
  }) as ValueRenderer<'LITERAL'>,
  BOOLEAN: (({ value }) => {
    return <span>{value?.content === true ? 'Yes' : 'No'}</span>;
  }) as ValueRenderer<'LITERAL'>,
  SOURCE_OF_FUNDS: DEFAULT_MULTIPLE_RENDERER,
  AMOUNT_RANGE: (({ value, onChange }) => {
    if (value == null) {
      return null;
    }
    return (
      <div className={style.amount_container}>
        <div className={style.amountCurrencyContainer}>
          <Label label={<div className={style.currencyLabel}>Currency</div>}>
            <Select
              value={value?.currency}
              isDisabled={onChange == null}
              options={CURRENCIES_SELECT_OPTIONS}
              onChange={(newValue) => {
                if (newValue) {
                  onChange?.({
                    ...value,
                    kind: 'AMOUNT_RANGE',
                    currency: newValue as CurrencyCode,
                  });
                }
              }}
            />
          </Label>
        </div>
        <div className={style.amountRangeLabel}>
          <Label label="From">
            <NumberInput
              min={0}
              value={value?.start ?? 0}
              htmlAttrs={{ type: 'number', style: { width: 100 } }}
              onChange={(newValue) => {
                if (newValue) {
                  onChange?.({
                    ...value,
                    kind: 'AMOUNT_RANGE',
                    start: newValue,
                  });
                }
              }}
            />
          </Label>
        </div>
        <div className={style.amountRangeLabel}>
          <Label label="To">
            <NumberInput
              min={0}
              value={value?.end ?? 0}
              htmlAttrs={{ type: 'number', style: { width: 100 } }}
              onChange={(newValue) => {
                if (newValue) {
                  onChange?.({
                    ...value,
                    kind: 'AMOUNT_RANGE',
                    end: newValue,
                  });
                }
              }}
            />
          </Label>
        </div>
      </div>
    );
  }) as ValueRenderer<'AMOUNT_RANGE'>,
};

export const NEW_VALUE_INFOS: Information<any>[] = [
  ({ newValue, defaultCurrency }) => {
    if (newValue.kind === 'AMOUNT_RANGE') {
      if (newValue.currency !== defaultCurrency) {
        return 'Transactions in other currencies will be auto converted for the defined value range.';
      }
    }
    return null;
  },
];

const RANGE_VALIDATIONS: Validation<'RANGE'>[] = [
  ({ allValues }) => {
    const overlaps = hasOverlaps(
      allValues.map((x) => [x.start ?? 0, x.end ?? Number.MAX_SAFE_INTEGER]),
    );
    return overlaps ? 'Ranges should not overlap' : null;
  },
];

const DAY_RANGE_VALIDATIONS: Validation<'DAY_RANGE'>[] = [
  ({ allValues }) => {
    const overlaps = hasOverlaps(
      allValues.map((x) => {
        const start = x.start ?? 0;
        const end = x.end ?? Number.MAX_SAFE_INTEGER;
        return [convertToDays(start, x.startGranularity), convertToDays(end, x.endGranularity)];
      }),
    );
    return overlaps ? 'Day ranges should not overlap' : null;
  },
];

const TIME_RANGE_VALIDATIONS: Validation<'TIME_RANGE'>[] = [
  ({ allValues }) => {
    for (const value of allValues) {
      const { startHour: x1, endHour: x2, timezone } = value;
      if (x1 == null || x2 == null || timezone == null || timezone === '') {
        return 'Start time, end time and timezone are required';
      }
      if (x1 >= x2) {
        return 'Start time should be before end time';
      }
    }
    return null;
  },
  ({ allValues }) => {
    const hasDifferentTimezone = uniq(allValues.map(({ timezone }) => timezone)).length > 1;
    if (hasDifferentTimezone) {
      return 'You can only set values in one timezone';
    }
    return null;
  },
  ({ allValues }) => {
    const overlaps = hasOverlaps(allValues.map(({ startHour, endHour }) => [startHour, endHour]));

    return overlaps ? 'Time ranges should not overlap' : null;
  },
];

const AMOUNT_RANGE_VALIDATIONS: Validation<'AMOUNT_RANGE'>[] = [
  ({ allValues }) => {
    for (const range of allValues) {
      if (range.start > range.end) {
        return 'Lower value must be less than the upper value.';
      }
    }
    return null;
  },
  ({ allValues }) => {
    const hasDifferentTimezone = uniq(allValues.map(({ currency }) => currency)).length > 1;
    if (hasDifferentTimezone) {
      return 'You can only set values in one currency. Transactions in other currencies will be auto converted for the defined value range.';
    }

    return null;
  },
  ({ allValues }) => {
    const overlaps = hasOverlaps(allValues.map(({ start, end }) => [start, end]));
    if (overlaps) {
      return 'Value ranges should not overlap.';
    }

    return null;
  },
];

export const PARAMETER_VALUES_FORM_VALIDATIONS: ParameterValuesFormValidations = {
  RANGE: RANGE_VALIDATIONS,
  DAY_RANGE: DAY_RANGE_VALIDATIONS,
  TIME_RANGE: TIME_RANGE_VALIDATIONS,
  AMOUNT_RANGE: AMOUNT_RANGE_VALIDATIONS,
};

export const DEFAULT_RISK_LEVEL = 'VERY_HIGH';

export const DEFAULT_RISK_VALUE: RiskScoreValueLevel = {
  type: 'RISK_LEVEL',
  value: DEFAULT_RISK_LEVEL,
};

export function validate<T extends RiskValueType>(
  dataType: RiskFactorDataType,
  dataTypeValidations: Validation<T>[],
  params: {
    newValue: RiskValueContentByType<T> | null;
    previousValues: RiskParameterValue['content'][];
  },
): string | null {
  const allRangeValues = [...params.previousValues, params.newValue]
    .filter(notEmpty)
    .filter((x) => x.kind === dataType);

  const result: string | null = dataTypeValidations.reduce<string | null>(
    (acc, validation): string | null => {
      if (acc != null) {
        return acc;
      }
      return validation({
        allValues: allRangeValues as RiskValueContentByType<T>[],
        ...params,
      });
    },
    null,
  );
  return result;
}

export const USER_RISK_PARAMETERS: RiskLevelTableItem[] = [
  {
    parameter: 'type',
    title: 'Customer type',
    description: 'Risk value for consumer (individuals) users',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_TYPE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userDetails.countryOfResidence',
    title: 'Country of residence',
    description: 'Risk based on customer residence country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userDetails.countryOfNationality',
    title: 'Country of nationality',
    description: 'Risk based on customer nationality country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userDetails.dateOfBirth',
    title: 'Customer age',
    description: 'Risk based on customer age range (years)',
    entity: 'CONSUMER_USER',
    dataType: 'RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'userSegment',
    title: 'User segment',
    description: 'Risk based on consumer user segment',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_SEGMENT',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'employmentStatus',
    title: 'User employment status',
    description: 'Risk based on consumer employment status',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_EMPLOYMENT_STATUS',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'occupation',
    title: 'User occupation',
    description: 'Risk based on consumer occupation',
    entity: 'CONSUMER_USER',
    dataType: 'STRING',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'reasonForAccountOpening',
    title: 'Reason for account opening',
    description: 'Risk based on reason for account opening',
    entity: 'CONSUMER_USER',
    dataType: 'STRING',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'sourceOfFunds',
    title: 'Source of funds',
    description: 'Risk based on source of funds',
    entity: 'CONSUMER_USER',
    dataType: 'SOURCE_OF_FUNDS',
    isDerived: false,
    parameterType: 'ITERABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
];

export const BUSINESS_RISK_PARAMETERS: RiskLevelTableItem[] = [
  {
    parameter: 'type',
    title: 'Customer type',
    description: 'Risk value for businesses (merchants/legal entities) users',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_TYPE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
    title: 'Business registration country',
    description: 'Risk value based on registration country of the business',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'shareHolders',
    title: 'Shareholders country of nationality',
    description: 'Risk value based on shareholder country of the nationality',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    targetIterableParameter: 'generalDetails.countryOfNationality',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'directors',
    title: 'Directors country of nationality',
    description: 'Risk value based on director country of the nationality',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    targetIterableParameter: 'generalDetails.countryOfNationality',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
    title: 'Business industry',
    description: 'Risk value based on the industry in which the business operates',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_INDUSTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    title: 'Company age',
    description: 'Risk based on business age range (years)',
    entity: 'BUSINESS',
    dataType: 'RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.userSegment',
    title: 'User segment',
    description: 'Risk based on business user segment',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_SEGMENT',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
    title: 'User registration status',
    description: 'Risk based on business user registration status',
    entity: 'BUSINESS',
    dataType: 'USER_REGISTRATION_STATUS',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
];

export const TRANSACTION_RISK_PARAMETERS: RiskLevelTableItem[] = [
  {
    parameter: 'originPaymentDetails.method',
    title: 'Origin payment method',
    description: 'Risk based on transaction origin payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationPaymentDetails.method',
    title: 'Destination payment method',
    description: 'Risk based on transaction destination payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originAmountDetails.country',
    title: 'Origin country',
    description: 'Risk based on transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationAmountDetails.country',
    title: 'Destination country',
    description: 'Risk based on transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originAmountDetails.transactionCurrency',
    title: 'Origin currency',
    description: 'Risk based on transaction origin currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationAmountDetails.transactionCurrency',
    title: 'Destination currency',
    description: 'Risk based on transaction destination currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'consumerCreatedTimestamp',
    title: 'Consumer user age on platform',
    description: 'Risk based on how long a consumer has been using your platform (days)',
    entity: 'TRANSACTION',
    dataType: 'DAY_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'businessCreatedTimestamp',
    title: 'Business user age on platform',
    description: 'Risk based on how long a business has been using your platform (Days)',
    entity: 'TRANSACTION',
    dataType: 'DAY_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'ipAddressCountry',
    title: 'IP address country',
    description: 'Risk based on IP address country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'type',
    title: 'Transaction type',
    description: 'Risk value based on type of transaction',
    entity: 'TRANSACTION',
    dataType: 'TRANSACTION_TYPES',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignOriginCountryConsumer',
    title: 'Foreign origin country (Consumer)',
    description:
      'Risk value based on whether the user country of residence is same as transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignDestinationCountryConsumer',
    title: 'Foreign destination country (Consumer)',
    description:
      'Risk value based on whether the user country of residence is same as transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignOriginCountryBusiness',
    title: 'Foreign origin country (Business)',
    description:
      'Risk value based on whether the user country of registration is same as transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'domesticOrForeignDestinationCountryBusiness',
    title: 'Foreign destination country (Business)',
    description:
      'Risk value based on whether the user country of registration is same as transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'timestamp',
    title: 'Transaction time',
    description: 'Risk value based on time of transaction',
    entity: 'TRANSACTION',
    dataType: 'TIME_RANGE',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: '3dsDone',
    title: '3DS Done',
    description: 'Risk value based on whether 3DS was done on CARD transaction',
    entity: 'TRANSACTION',
    dataType: 'BOOLEAN',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'cardIssuedCountry',
    title: 'Card issued country',
    description: 'Risk value based on card issued country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originMccCode',
    title: 'Origin MCC code',
    description: 'Risk value based on Origin MCC code',
    entity: 'TRANSACTION',
    dataType: 'STRING',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationMccCode',
    title: 'Destination MCC code',
    description: 'Risk value based on Destination MCC code',
    entity: 'TRANSACTION',
    dataType: 'STRING',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originPaymentDetails.bankName',
    title: 'Origin bank name',
    description:
      'Risk value based on origin bank name under generic bank account, ACH, IBAN and SWIFT',
    entity: 'TRANSACTION',
    dataType: 'BANK_NAMES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationPaymentDetails.bankName',
    title: 'Destination bank name',
    description:
      'Risk value based on destination bank name under generic bank account, ACH, IBAN and SWIFT',
    entity: 'TRANSACTION',
    dataType: 'BANK_NAMES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'originUserSarFiled',
    title: 'Origin user SAR filed',
    description: 'Risk value based on whether a SAR was filed for the origin user',
    entity: 'TRANSACTION',
    dataType: 'BOOLEAN',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
    requiredFeatures: ['SAR', 'DEMO_MODE'],
  },
  {
    parameter: 'destinationUserSarFiled',
    title: 'Destination user SAR filed',
    description: 'Risk value based on whether a SAR was filed for the destination user',
    entity: 'TRANSACTION',
    dataType: 'CARD_3DS_STATUS',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
    requiredFeatures: ['SAR', 'DEMO_MODE'],
  },
  {
    parameter: 'originAmountDetails.transactionAmount',
    title: 'Origin transaction amount',
    description: 'Risk based on origin transaction amount',
    entity: 'TRANSACTION',
    dataType: 'AMOUNT_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: false,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
  {
    parameter: 'destinationAmountDetails.transactionAmount',
    title: 'Destination transaction amount',
    description: 'Risk based on destination transaction amount',
    entity: 'TRANSACTION',
    dataType: 'AMOUNT_RANGE',
    parameterType: 'VARIABLE',
    isDerived: true,
    isNullableAllowed: true,
    defaultValue: DEFAULT_RISK_VALUE,
    weight: 1,
  },
];

export const ALL_RISK_PARAMETERS = [
  ...USER_RISK_PARAMETERS,
  ...BUSINESS_RISK_PARAMETERS,
  ...TRANSACTION_RISK_PARAMETERS,
];
