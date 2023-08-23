import { Tag } from 'antd';
import _ from 'lodash';
import React, { useEffect } from 'react';
import style from './style.module.less';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import {
  DataType,
  ParameterName,
  ParameterValues,
  RiskLevelTable,
  riskValueDayRange,
  riskValueLiteral,
  riskValueMultiple,
  riskValueRange,
  riskValueTimeRange,
  RiskValueType,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import COUNTRIES from '@/utils/countries';
import { getPaymentMethodTitle, isPaymentMethod, PAYMENT_METHODS } from '@/utils/payments';
import { TRANSACTION_TYPES } from '@/utils/transactionType';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import { businessType, consumerType } from '@/utils/customer-type';
import { RiskLevel } from '@/utils/risk-levels';
import Slider from '@/components/library/Slider';
import {
  RiskParameterValueDayRange,
  RiskParameterValueDayRangeEndGranularityEnum,
  RiskParameterValueDayRangeStartGranularityEnum,
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
  RiskParameterValueTimeRange,
} from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import TransactionTypeTag from '@/components/library/TransactionTypeTag';
import { isTransactionType } from '@/utils/api/transactions';
import { RESIDENCE_TYPES } from '@/utils/residence-types';
import { capitalizeWords } from '@/utils/tags';
import { useApi } from '@/api';
import { TRANSACTIONS_UNIQUES, USERS_UNIQUES } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import { timezones } from '@/utils/timezones';
import { _3DS_DONE_OPTIONS } from '@/utils/3dsOptions';
import { convertToDays } from '@/utils/dayjs';
import NumberInput from '@/components/library/NumberInput';
import { getOr } from '@/utils/asyncResource';

type InputRendererProps<T extends RiskValueType> = {
  disabled?: boolean;
  value?: RiskValueContentByType<T> | null;
  existedValues?: RiskValueContentByType<T>[];
  onChange: (values: RiskValueContentByType<T>) => void;
  setShouldShowNewValueInput: (shouldShow: boolean) => void;
  shouldShowNewValueInput: boolean;
  setOnlyDeleteLast: (onlyDeleteLast: boolean) => void;
};
export type InputRenderer<T extends RiskValueType> = (
  props: InputRendererProps<T>,
) => React.ReactNode;

export type ValueRenderer<T extends RiskValueType> = (props: {
  value?: RiskValueContentByType<T>;
  handleRemoveValue?: (value: string) => void;
}) => React.ReactNode;

type RiskValueContentByType<T extends RiskValueType> = T extends 'LITERAL'
  ? RiskParameterValueLiteral
  : T extends 'RANGE'
  ? RiskParameterValueRange
  : T extends 'MULTIPLE'
  ? RiskParameterValueMultiple
  : T extends 'TIME_RANGE'
  ? RiskParameterValueTimeRange
  : T extends 'DAY_RANGE'
  ? RiskParameterValueDayRange
  : never;

export const DATA_TYPE_TO_VALUE_TYPE: { [key in DataType]: RiskValueType } = {
  STRING: 'LITERAL',
  RANGE: 'RANGE',
  DAY_RANGE: 'DAY_RANGE',
  COUNTRY: 'MULTIPLE',
  CURRENCY: 'MULTIPLE',
  PAYMENT_METHOD: 'MULTIPLE',
  CONSUMER_USER_TYPE: 'MULTIPLE',
  BUSINESS_USER_TYPE: 'MULTIPLE',
  TRANSACTION_TYPES: 'MULTIPLE',
  RESIDENCE_TYPES: 'MULTIPLE',
  BUSINESS_INDUSTRY: 'MULTIPLE',
  TIME_RANGE: 'TIME_RANGE',
  BOOLEAN: 'LITERAL',
  BUSINESS_USER_SEGMENT: 'MULTIPLE',
  CONSUMER_USER_SEGMENT: 'MULTIPLE',
  USER_REGISTRATION_STATUS: 'MULTIPLE',
  BANK_NAMES: 'MULTIPLE',
};

export const DEFAULT_RISK_LEVEL = 'VERY_HIGH';

const DAY_RANGE_GRANULARITY = [
  { value: 'DAYS', label: 'days' },
  { value: 'MONTHS', label: 'months' },
  { value: 'YEARS', label: 'years' },
];

const USER_REGISTRATION_STATUS_OPTIONS = [
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'UNREGISTERED', label: 'Unregistered' },
];

const EXTENDED_DAY_RANGE_GRANULARITY = [
  ...DAY_RANGE_GRANULARITY,
  { value: 'INFINITE', label: 'and above' },
];

// todo: i18n
export const USER_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'type',
    title: 'Customer type',
    description: 'Risk value for consumer (individuals) users',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_TYPE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'userDetails.countryOfResidence',
    title: 'Country of residence',
    description: 'Risk based on customer residence country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'userDetails.countryOfNationality',
    title: 'Country of nationality',
    description: 'Risk based on customer nationality country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'userDetails.dateOfBirth',
    title: 'Customer age',
    description: 'Risk based on customer age range (Years)',
    entity: 'CONSUMER_USER',
    dataType: 'RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'userSegment',
    title: 'User Segment',
    description: 'Risk based on consumer user segment',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_SEGMENT',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
];

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

const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const timeZonesDataMap = _.keyBy(timeZonesData, 'value');

export const BUSINESS_USER_SEGMENT_OPTIONS = [
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship' },
  { value: 'LIMITED', label: 'Limited' },
  { value: 'SMB', label: 'SMB' },
  { value: 'SMALL', label: 'Small' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LARGE', label: 'Large' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export const CONSUMER_USER_SEGMENT_OPTIONS = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'PROFESSIONAL', label: 'Professional' },
];

export const BUSINESS_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'type',
    title: 'Customer type',
    description: 'Risk value for businesses (merchants/legal entities) users',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_TYPE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
    title: 'Business registration country',
    description: 'Risk value based on registration country of the business',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
    title: 'Business industry',
    description: 'Risk value based on the industry in which the business operates',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_INDUSTRY',
    isDerived: false,
    parameterType: 'ITERABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    title: 'Company age',
    description: 'Risk based on business age range (Years)',
    entity: 'BUSINESS',
    dataType: 'RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.userSegment',
    title: 'User segment',
    description: 'Risk based on business user segment',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_SEGMENT',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
    title: 'User registration status',
    description: 'Risk based on business user registration status',
    entity: 'BUSINESS',
    dataType: 'USER_REGISTRATION_STATUS',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
];

export const TRANSACTION_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'originPaymentDetails.method',
    title: 'Origin payment method',
    description: 'Risk based on transaction origin payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'destinationPaymentDetails.method',
    title: 'Destination payment method',
    description: 'Risk based on transaction destination payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'originAmountDetails.country',
    title: 'Origin country',
    description: 'Risk based on transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'destinationAmountDetails.country',
    title: 'Destination country',
    description: 'Risk based on transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'originAmountDetails.transactionCurrency',
    title: 'Origin currency',
    description: 'Risk based on transaction origin currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'destinationAmountDetails.transactionCurrency',
    title: 'Destination currency',
    description: 'Risk based on transaction destination currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'consumerCreatedTimestamp',
    title: 'Consumer user age on platform',
    description: 'Risk based on how long a consumer has been using your platform (Days)',
    entity: 'TRANSACTION',
    dataType: 'DAY_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'businessCreatedTimestamp',
    title: 'Business user age on platform',
    description: 'Risk based on how long a business has been using your platform (Days)',
    entity: 'TRANSACTION',
    dataType: 'DAY_RANGE',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'ipAddressCountry',
    title: 'IP Address country',
    description: 'Risk based on IP address country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'type',
    title: 'Transaction type',
    description: 'Risk value based on type of transaction',
    entity: 'TRANSACTION',
    dataType: 'TRANSACTION_TYPES',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'timestamp',
    title: 'Transaction time',
    description: 'Risk value based on time of transaction',
    entity: 'TRANSACTION',
    dataType: 'TIME_RANGE',
    isDerived: false,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: '_3dsDone',
    title: '3DS Done',
    description: 'Risk value based on whether 3DS was done on CARD transaction',
    entity: 'TRANSACTION',
    dataType: 'BOOLEAN',
    isDerived: true,
    parameterType: 'VARIABLE',
    isNullableAllowed: true,
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'cardIssuedCountry',
    title: 'Card issued country',
    description: 'Risk value based on card issued country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'originPaymentDetails.bankName',
    title: 'Origin bank name',
    description:
      'Risk value based on origin bank name under Generic bank account, ACH, IBAN and SWIFT',
    entity: 'TRANSACTION',
    dataType: 'BANK_NAMES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
  {
    parameter: 'destinationPaymentDetails.bankName',
    title: 'Destination bank name',
    description:
      'Risk value based on destination bank name under Generic bank account, ACH, IBAN and SWIFT',
    entity: 'TRANSACTION',
    dataType: 'BANK_NAMES',
    isDerived: true,
    parameterType: 'VARIABLE',
    defaultRiskLevel: DEFAULT_RISK_LEVEL,
  },
];

export const ALL_RISK_PARAMETERS = [
  ...USER_RISK_PARAMETERS,
  ...BUSINESS_RISK_PARAMETERS,
  ...TRANSACTION_RISK_PARAMETERS,
];

const MultipleSelect: React.FC<
  InputRendererProps<'MULTIPLE'> & {
    options: Array<{ value: string; label: string }>;
  }
> = (props) => {
  const { value, disabled, onChange, options, existedValues = [] } = props;
  const disabledOptions: string[] = existedValues.flatMap((x) =>
    x.values.map((y) => `${y.content}`),
  );
  return (
    <Select<string>
      style={{ width: '100%' }}
      value={value?.values.map(({ content }) => `${content}`) ?? []}
      onChange={(value) => {
        onChange(riskValueMultiple((value as string[]).map((x) => riskValueLiteral(x))));
      }}
      isDisabled={disabled}
      options={options.map((x) => ({ ...x, isDisabled: disabledOptions.includes(x.value) }))}
      mode="TAGS"
    />
  );
};

const SingleSelect: React.FC<
  InputRendererProps<'LITERAL'> & {
    options: Array<{ value: RiskParameterValueLiteral['content']; label: string }>;
  }
> = (props) => {
  const { value, disabled, onChange, options, existedValues = [] } = props;
  const disabledOptions: RiskParameterValueLiteral['content'][] = existedValues.map(
    (x) => x.content,
  );

  return (
    <Select<RiskParameterValueLiteral['content']>
      style={{ width: '100%' }}
      value={value?.content ?? ''}
      onChange={(value) => {
        onChange(riskValueLiteral(value));
      }}
      isDisabled={disabled}
      mode="SINGLE"
      options={options.map((x) => ({ ...x, isDisabled: disabledOptions.includes(x.value) }))}
    />
  );
};

export const INPUT_RENDERERS: { [key in DataType]: InputRenderer<any> } = {
  STRING: (({ disabled, value, onChange }) => (
    <TextInput
      isDisabled={disabled}
      value={`${value?.content ?? ''}`}
      onChange={(val) => onChange(riskValueLiteral(val))}
    />
  )) as InputRenderer<'LITERAL'>,
  COUNTRY: ((props) => {
    return (
      <MultipleSelect
        options={Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] }))}
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
  RANGE: (({ disabled, value, onChange }) => {
    const range = [value?.start ?? 0, value?.end ?? 0];
    return (
      <>
        <Slider
          mode="RANGE"
          marks={range.reduce((acc, x) => ({ ...acc, [x]: x }), {})}
          endExclusive={true}
          value={[range[0], range[1]]}
          isDisabled={disabled}
          onChange={(value) => {
            if (value != null) {
              onChange(riskValueRange(value[0], value[1]));
            }
          }}
        />
      </>
    );
  }) as InputRenderer<'RANGE'>,
  DAY_RANGE: (({
    disabled,
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
          <Label label="From" element="div">
            <div className={style.dayRangeInputContainer}>
              <NumberInput
                isDisabled={true}
                value={previousEnd}
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
              />
              <Select
                isDisabled={true}
                options={DAY_RANGE_GRANULARITY}
                value={previousEndGranularity}
                style={{ width: 150 }}
              />
            </div>
          </Label>
        </div>

        <div className={style.dayRangeContainer}>
          <Label label="To" element="div">
            <div className={style.dayRangeInputContainer}>
              <NumberInput
                isDisabled={disabled || value?.endGranularity === 'INFINITE'}
                htmlAttrs={{ type: 'number', style: { width: 100 } }}
                value={value?.endGranularity === 'INFINITE' ? undefined : value?.end}
                onChange={(val) => {
                  onChange(
                    riskValueDayRange(
                      startValue,
                      previousEndGranularity as RiskParameterValueDayRangeStartGranularityEnum,
                      value?.endGranularity === 'INFINITE' ? 0 : (val as number),
                      value?.endGranularity ?? previousEndGranularity,
                    ),
                  );
                }}
              />
              <Select
                isDisabled={disabled}
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
                style={{ width: 150 }}
                mode="SINGLE"
              />
            </div>
          </Label>
        </div>
      </div>
    ) : null;
  }) as InputRenderer<'DAY_RANGE'>,
  TIME_RANGE: (({ disabled, value, onChange }) => {
    return (
      <div style={{ display: 'grid', gridAutoFlow: 'column', gap: '.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Label label="Start Time" element="div">
            <Select
              isDisabled={disabled}
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
          <Label label="End Time" element="div">
            <Select<number>
              isDisabled={disabled}
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
          <Label label="Time Zone" element="div">
            <Select
              isDisabled={disabled}
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
  BOOLEAN: ((props) => {
    return <SingleSelect options={_3DS_DONE_OPTIONS} {...props} />;
  }) as InputRenderer<'LITERAL'>,
};

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

const DEFAULT_RANGE_RENDERER: ValueRenderer<'RANGE'> = ({ value }) => {
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
    <Slider
      mode="RANGE"
      endExclusive={true}
      marks={marks}
      defaultValue={[value.start ?? 0, value.end ?? 0]}
      isDisabled={true}
    />
  );
};

const DEFAULT_DAY_RANGE_RENDERER: ValueRenderer<'DAY_RANGE'> = ({ value }) => {
  if (value == null) {
    return null;
  }

  return (
    <div className={style.dayRangeRoot}>
      <div className={style.dayRangeContainer}>
        <Label label="From" element="div">
          <div className={style.dayRangeInputContainer}>
            <NumberInput
              isDisabled={true}
              htmlAttrs={{ type: 'number', style: { width: 100 } }}
              value={value.start}
            />
            <Select
              isDisabled={true}
              value={value.startGranularity}
              options={DAY_RANGE_GRANULARITY}
              style={{ width: 150 }}
            />
          </div>
        </Label>
      </div>
      <div className={style.dayRangeContainer}>
        <Label label="To" element="div">
          <div className={style.dayRangeInputContainer}>
            <NumberInput
              isDisabled={true}
              htmlAttrs={{ type: 'number', style: { width: 100 } }}
              value={value.endGranularity === 'INFINITE' ? undefined : value.end}
            />
            <Select
              isDisabled={true}
              value={value.endGranularity}
              options={EXTENDED_DAY_RANGE_GRANULARITY}
              style={{ width: 150 }}
            />
          </div>
        </Label>
      </div>
    </div>
  );
};

const DEFAULT_STRING_RENDERER: ValueRenderer<'LITERAL'> = ({ value }) => (
  <span>{value?.content ?? ''}</span>
);

export const VALUE_RENDERERS: { [key in DataType]: ValueRenderer<any> } = {
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
      <span>
        {value.values.map((item) => (
          <Tag
            onClose={() => {
              const content = item.content;
              if (handleRemoveValue && typeof content === 'string') {
                handleRemoveValue(content);
              }
            }}
            style={{ marginBottom: '4px' }}
            closable
          >
            <CountryDisplay
              key={`${item.content}`}
              isoCode={`${item.content}`}
              flagStyle={{ marginRight: '4px' }}
            />
          </Tag>
        ))}
      </span>
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
          return <TransactionTypeTag key={itemValue} transactionType={itemValue} />;
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
  BOOLEAN: (({ value }) => {
    return (
      <span>{value?.content === true ? 'Yes' : value?.content === false ? 'No' : 'Unknown'}</span>
    );
  }) as ValueRenderer<'LITERAL'>,
};

type Validation<T extends RiskValueType> = (params: {
  newParameterName: ParameterName;
  newValue: RiskValueContentByType<T>;
  newRiskLevel: RiskLevel | null;
  previousValues: ParameterValues;
}) => null | string;

export const NEW_VALUE_VALIDATIONS: Validation<any>[] = [
  ({ newParameterName, newValue, previousValues }) => {
    if (
      newParameterName === 'userDetails.dateOfBirth' ||
      newParameterName === 'legalEntity.companyRegistrationDetails.dateOfRegistration' ||
      newParameterName === 'createdTimestamp' ||
      newParameterName === 'timestamp'
    ) {
      if (newValue.kind === 'RANGE') {
        const { start: x1 = 0, end: x2 = Number.MAX_SAFE_INTEGER } = newValue;
        const hasOverlaps = previousValues.some(({ parameterValue }) => {
          if (parameterValue.content.kind !== 'RANGE') {
            return false;
          }
          const { start: y1 = 0, end: y2 = Number.MAX_SAFE_INTEGER } = parameterValue.content;
          return x1 < y2 && y1 < x2;
        });
        if (hasOverlaps) {
          return 'Age ranges should not overlap';
        }
      } else if (newValue.kind === 'DAY_RANGE') {
        if (!newValue.endGranularity) {
          return 'Select end granularity';
        }

        if (newValue.endGranularity === 'INFINITE') {
          return null;
        }

        let { start: x1 = 0, end: x2 = Number.MAX_SAFE_INTEGER } = newValue;

        if (x1 == null || x2 == null) {
          return 'Start and end range should be specified';
        }

        x1 = convertToDays(x1, newValue.startGranularity);
        x2 = convertToDays(x2, newValue.endGranularity);

        if (x1 >= x2) {
          return 'Start date should be before end date';
        }

        const hasOverlaps = previousValues.some(({ parameterValue }) => {
          if (parameterValue.content.kind !== 'DAY_RANGE') {
            return false;
          }
          let { end: y2 = Number.MAX_SAFE_INTEGER } = parameterValue.content;
          y2 = convertToDays(
            y2,
            parameterValue.content.endGranularity as RiskParameterValueDayRangeStartGranularityEnum,
          );

          return x1 < y2;
        });
        if (hasOverlaps) {
          return 'Age ranges should not overlap';
        }
      } else if (newValue.kind === 'TIME_RANGE') {
        const { startHour: x1, endHour: x2, timezone } = newValue;
        if (x1 == null || x2 == null || timezone == null || timezone === '') {
          return 'Start time, end time and timezone are required';
        }
        if (x1 >= x2) {
          return 'Start time should be before end time';
        }
        // do not allow different timezones
        const hasDifferentTimezone = previousValues.some(({ parameterValue }) => {
          if (parameterValue.content.kind !== 'TIME_RANGE') {
            return false;
          }
          return parameterValue.content.timezone !== timezone;
        });
        if (hasDifferentTimezone) {
          return 'You can only set values in one timezone';
        }
        // do not allow overlapping
        const hasOverlaps = previousValues.some(({ parameterValue }) => {
          if (parameterValue.content.kind !== 'TIME_RANGE') {
            return false;
          }
          const { startHour: y1, endHour: y2 } = parameterValue.content;
          if (y1 == null || y2 == null) {
            return false;
          }
          return x1 < y2 && y1 < x2;
        });
        if (hasOverlaps) {
          return 'Time ranges should not overlap';
        }
      }
    }
    return null;
  },
];
