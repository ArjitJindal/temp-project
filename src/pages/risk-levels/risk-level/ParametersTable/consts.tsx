import React from 'react';
import { Input, Select } from 'antd';
import {
  DataType,
  ParameterName,
  ParameterValues,
  RiskLevelTable,
  riskValueLiteral,
  riskValueMultiple,
  riskValueRange,
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
import { humanizeCamelCase } from '@/utils/tags';

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
    dataType: 'STRING',
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
        options={TRANSACTION_TYPES.map((type) => ({ value: type, label: humanizeCamelCase(type) }))}
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
  CONSUMER_USER_TYPE: DEFAULT_MULTIPLE_RENDERER,
  BUSINESS_USER_TYPE: DEFAULT_MULTIPLE_RENDERER,
  RANGE: DEFAULT_RANGE_RENDERER,
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
      newParameterName === 'createdTimestamp'
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
      }
    }
    return null;
  },
];
