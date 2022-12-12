import React from 'react';
import { Input, Select } from 'antd';
import moment from 'moment-timezone';
import _ from 'lodash';
import {
  DataType,
  ParameterName,
  ParameterValues,
  RiskLevelTable,
  riskValueLiteral,
  riskValueMultiple,
  riskValueRange,
  riskValueTimeRange,
  RiskValueType,
} from '@/pages/risk-levels/risk-level/ParametersTable/types';
import COUNTRIES from '@/utils/countries';
import { getPaymentMethodTitle, isPaymentMethod, PAYMENT_METHODS } from '@/utils/payments';
import { TRANSACTION_TYPES } from '@/utils/transactionType';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import { businessType, consumerType } from '@/utils/customer-type';
import { RiskLevel } from '@/utils/risk-levels';
import Slider from '@/components/ui/Slider';
import {
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
  RiskParameterValueTimeRange,
} from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { isTransactionType } from '@/utils/api/transactions';
import { RESIDENCE_TYPES } from '@/utils/residence-types';

import { capitalizeWords } from '@/utils/tags';
import { useApi } from '@/api';
import { BUSINESS_USERS_UNIQUES } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import { map } from '@/utils/asyncResource';

type InputRendererProps<T extends RiskValueType> = {
  disabled?: boolean;
  value?: RiskValueContentByType<T> | null;
  existedValues?: RiskValueContentByType<T>[];
  onChange: (values: RiskValueContentByType<T>) => void;
};
export type InputRenderer<T extends RiskValueType> = (
  props: InputRendererProps<T>,
) => React.ReactNode;

export type ValueRenderer<T extends RiskValueType> = (props: {
  value?: RiskValueContentByType<T>;
}) => React.ReactNode;

type RiskValueContentByType<T extends RiskValueType> = T extends 'LITERAL'
  ? RiskParameterValueLiteral
  : T extends 'RANGE'
  ? RiskParameterValueRange
  : T extends 'MULTIPLE'
  ? RiskParameterValueMultiple
  : T extends 'TIME_RANGE'
  ? RiskParameterValueTimeRange
  : never;

export const DATA_TYPE_TO_VALUE_TYPE: { [key in DataType]: RiskValueType } = {
  STRING: 'LITERAL',
  RANGE: 'RANGE',
  COUNTRY: 'MULTIPLE',
  CURRENCY: 'MULTIPLE',
  PAYMENT_METHOD: 'MULTIPLE',
  CONSUMER_USER_TYPE: 'MULTIPLE',
  BUSINESS_USER_TYPE: 'MULTIPLE',
  TRANSACTION_TYPES: 'MULTIPLE',
  RESIDENCE_TYPES: 'MULTIPLE',
  BUSINESS_INDUSTRY: 'MULTIPLE',
  TIME_RANGE: 'TIME_RANGE',
};

// todo: i18n
export const USER_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'type',
    title: 'Customer Type',
    description: 'Risk value for consumer (individuals) users',
    entity: 'CONSUMER_USER',
    dataType: 'CONSUMER_USER_TYPE',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'userDetails.countryOfResidence',
    title: 'Country of Residence',
    description: 'Risk based on customer residence country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'userDetails.countryOfNationality',
    title: 'Country of Nationality',
    description: 'Risk based on customer nationality country',
    entity: 'CONSUMER_USER',
    dataType: 'COUNTRY',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'userDetails.dateOfBirth',
    title: 'Customer Age',
    description: 'Risk based on customer age range (Years)',
    entity: 'CONSUMER_USER',
    dataType: 'RANGE',
    riskScoreType: 'KRS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
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

const timeZonesData = moment.tz.names().map((name) => ({
  value: name,
  label: name,
}));

const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const timeZonesDataMap = _.keyBy(timeZonesData, 'value');

export const BUSINESS_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'type',
    title: 'Customer Type',
    description: 'Risk value for businesses (merchants/legal entities) users',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_USER_TYPE',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
    title: 'Business Registration Country',
    description: 'Risk value based on registration country of the business',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'shareHolders',
    title: 'Shareholders Country of Nationality',
    description: 'Risk value based on shareholder country of the nationality',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'ITERABLE',
    matchType: 'DIRECT',
    targetIterableParameter: 'generalDetails.countryOfNationality',
  },
  {
    parameter: 'directors',
    title: 'Directors Country of Nationality',
    description: 'Risk value based on director country of the nationality',
    entity: 'BUSINESS',
    dataType: 'COUNTRY',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'ITERABLE',
    matchType: 'DIRECT',
    targetIterableParameter: 'generalDetails.countryOfNationality',
  },
  {
    parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
    title: 'Business Industry',
    description: 'Risk value based on the industry in which the business operates',
    entity: 'BUSINESS',
    dataType: 'BUSINESS_INDUSTRY',
    riskScoreType: 'KRS',
    isDerived: false,
    parameterType: 'ITERABLE',
    matchType: 'ARRAY_MATCH',
  },
  {
    parameter: 'legalEntity.companyRegistrationDetails.dateOfRegistration',
    title: 'Company Age',
    description: 'Risk based on business age range (Years)',
    entity: 'BUSINESS',
    dataType: 'RANGE',
    riskScoreType: 'KRS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
];

export const TRANSACTION_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'originPaymentDetails.method',
    title: 'Origin Payment Method',
    description: 'Risk based on transaction origin payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'destinationPaymentDetails.method',
    title: 'Destination Payment Method',
    description: 'Risk based on transaction destination payment method',
    entity: 'TRANSACTION',
    dataType: 'PAYMENT_METHOD',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'originAmountDetails.country',
    title: 'Origin Country',
    description: 'Risk based on transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'destinationAmountDetails.country',
    title: 'Destination Country',
    description: 'Risk based on transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'originAmountDetails.transactionCurrency',
    title: 'Origin Currency',
    description: 'Risk based on transaction origin currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'destinationAmountDetails.transactionCurrency',
    title: 'Destination Currency',
    description: 'Risk based on transaction destination currency',
    entity: 'TRANSACTION',
    dataType: 'CURRENCY',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'createdTimestamp',
    title: 'Consumer User age on Platform',
    description: 'Risk based on how long a consumer has been using your platform (Years)',
    entity: 'CONSUMER_USER',
    dataType: 'RANGE',
    riskScoreType: 'ARS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'ipAddressCountry',
    title: 'IP Address Country',
    description: 'Risk based on IP address country',
    entity: 'TRANSACTION',
    dataType: 'COUNTRY',
    riskScoreType: 'ARS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'type',
    title: 'Transaction Type',
    description: 'Risk value based on type of transaction',
    entity: 'TRANSACTION',
    dataType: 'TRANSACTION_TYPES',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'domesticOrForeignOriginCountryConsumer',
    title: 'Foreign Origin Country (Consumer)',
    description:
      'Risk value based on whether the user country of residence is same as transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    riskScoreType: 'ARS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'domesticOrForeignDestinationCountryConsumer',
    title: 'Foreign Destination Country (Consumer)',
    description:
      'Risk value based on whether the user country of residence is same as transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    riskScoreType: 'ARS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'domesticOrForeignOriginCountryBusiness',
    title: 'Foreign Origin Country (Business)',
    description:
      'Risk value based on whether the user country of registration is same as transaction origin country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    riskScoreType: 'ARS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'domesticOrForeignDestinationCountryBusiness',
    title: 'Foreign Destination Country (Business)',
    description:
      'Risk value based on whether the user country of registration is same as transaction destination country',
    entity: 'TRANSACTION',
    dataType: 'RESIDENCE_TYPES',
    riskScoreType: 'ARS',
    isDerived: true,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
  },
  {
    parameter: 'timestamp',
    title: 'Transaction Time',
    description: 'Risk value based on time of transaction',
    entity: 'TRANSACTION',
    dataType: 'TIME_RANGE',
    riskScoreType: 'ARS',
    isDerived: false,
    parameterType: 'VARIABLE',
    matchType: 'DIRECT',
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
    <Select<string[]>
      mode="multiple"
      style={{ width: '100%' }}
      value={value?.values.map(({ content }) => `${content}`) ?? []}
      onChange={(value) => {
        onChange(riskValueMultiple(value.map((x) => riskValueLiteral(x))));
      }}
      showSearch={true}
      disabled={disabled}
      filterOption={(input, option) => {
        const optionValue = option?.children?.toString() ?? '';
        return (
          optionValue.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
          optionValue.toLowerCase().indexOf(input.toLowerCase()) >= 0
        );
      }}
    >
      {options.map(({ value, label }) => (
        <Select.Option disabled={disabledOptions.includes(value)} key={value} value={value}>
          {label}
        </Select.Option>
      ))}
    </Select>
  );
};

export const INPUT_RENDERERS: { [key in DataType]: InputRenderer<any> } = {
  STRING: (({ disabled, value, onChange }) => (
    <Input
      disabled={disabled}
      value={`${value?.content ?? ''}`}
      onChange={(e) => onChange(riskValueLiteral(e.target.value))}
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
    const result = useQuery(BUSINESS_USERS_UNIQUES(), () => api.getUsersUniques());
    const businessIndustryRes = map(result.data, ({ businessIndustry }) => businessIndustry);
    return (
      businessIndustryRes['value'] && (
        <MultipleSelect
          options={businessIndustryRes['value'].map((entry: string) => ({
            value: entry,
            label: entry,
          }))}
          {...props}
        />
      )
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
    // const range = (values[0] ?? '0,0').split(',').map((x) => parseInt(x) || 0);
    const range = [value?.start ?? 0, value?.end ?? 0];
    return (
      <>
        <Slider
          range
          marks={range.reduce((acc, x) => ({ ...acc, [x]: x }), {})}
          endExclusive={true}
          value={[range[0], range[1]]}
          disabled={disabled}
          onChange={(value) => {
            // onChange([value.map((x) => `${x}`).join(',')]);
            onChange(riskValueRange(value[0], value[1]));
          }}
        />
      </>
    );
  }) as InputRenderer<'RANGE'>,
  TIME_RANGE: (({ disabled, value, onChange }) => {
    return (
      <div style={{ display: 'grid', gridAutoFlow: 'column', gap: '.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div>Start Time</div>
          <Select
            disabled={disabled}
            onChange={(val) =>
              onChange(
                riskValueTimeRange(val, value?.endHour ?? 0, value?.timezone ?? currentTimeZone),
              )
            }
            options={timeValues}
            value={value?.startHour ?? 0}
            showSearch
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div>End Time</div>
          <Select
            disabled={disabled}
            onChange={(val) =>
              onChange(
                riskValueTimeRange(value?.startHour ?? 0, val, value?.timezone ?? currentTimeZone),
              )
            }
            options={timeValues}
            value={value?.endHour ?? 0}
            showSearch
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div>Timezone</div>
          <Select
            disabled={disabled}
            onChange={(val) =>
              onChange(riskValueTimeRange(value?.startHour ?? 0, value?.endHour ?? 0, val))
            }
            options={timeZonesData}
            value={value?.timezone ?? currentTimeZone}
            showSearch
          />
        </div>
      </div>
    );
  }) as InputRenderer<'TIME_RANGE'>,
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
      range
      endExclusive={true}
      marks={marks}
      defaultValue={[value.start ?? 0, value.end ?? 0]}
      disabled={true}
    />
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
  COUNTRY: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <span>
        {value.values.map((item) => (
          <CountryDisplay key={`${item.content}`} isoCode={`${item.content}`} />
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
  RANGE: DEFAULT_RANGE_RENDERER,
  TIME_RANGE: (({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <div style={{ display: 'grid', gridAutoFlow: 'column', gap: '.5rem' }}>
        <p>
          {timeIn24HourFormat(value?.startHour)} - {timeIn24HourFormat(value?.endHour)}{' '}
          {`(${timeZonesDataMap[value?.timezone]?.label})`}
        </p>
      </div>
    );
  }) as ValueRenderer<'TIME_RANGE'>,
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
