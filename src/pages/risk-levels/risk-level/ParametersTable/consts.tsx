import React from 'react';
import { Input, Select } from 'antd';
import {
  DataTypes,
  ParameterName,
  ParameterValues,
  RiskLevelTable,
} from '@/pages/risk-levels/risk-level/ParametersTable/types';
import COUNTRIES from '@/utils/countries';
import { PAYMENT_METHODS } from '@/utils/payments';
import { TRANSACTION_TYPES } from '@/utils/transactionType';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import { businessType, consumerType } from '@/utils/customer-type';
import { RiskLevel } from '@/utils/risk-levels';
import Slider from '@/components/ui/Slider';

type InputRendererProps = {
  disabled?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
};
export type InputRenderer = (props: InputRendererProps) => React.ReactNode;

export type ValueRenderer = (props: { value: string | null }) => React.ReactNode;

// todo: i18n
export const USER_RISK_PARAMETERS: RiskLevelTable = [
  {
    parameter: 'type',
    title: 'Customer Type',
    description: 'Risk value for consumer (individuals) users',
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    description: 'Risk based on customer age range',
    type: 'RANGE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    description: 'Risk based on business age range',
    type: 'RANGE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    description: 'Risk based on how long a consumer has been using your platform',
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
    type: 'DISCRETE',
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
  InputRendererProps & { options: Array<{ value: string; label: string }> }
> = ({ values, disabled, onChange, options }) => {
  return (
    <Select<string[]>
      mode="multiple"
      style={{ width: '100%' }}
      value={values}
      onChange={onChange}
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
        <Select.Option value={value}>{label}</Select.Option>
      ))}
    </Select>
  );
};

export const INPUT_RENDERERS: { [key in DataTypes]: InputRenderer } = {
  STRING: ({ disabled, values, onChange }) => (
    <Input
      disabled={disabled}
      value={values[0] ?? ''}
      onChange={(e) => onChange([e.target.value])}
    />
  ),
  COUNTRY: (props) => {
    return (
      <MultipleSelect
        options={Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] }))}
        {...props}
      />
    );
  },
  CURRENCY: (props) => {
    return <MultipleSelect options={CURRENCIES_SELECT_OPTIONS} {...props} />;
  },
  CONSUMER_USER_TYPE: (props) => {
    return <MultipleSelect options={consumerType} {...props} />;
  },
  BUSINESS_USER_TYPE: (props) => {
    return <MultipleSelect options={businessType} {...props} />;
  },
  BUSINESS_REGISTRATION_COUNTRY: (props) => {
    return (
      <MultipleSelect
        options={Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] }))}
        {...props}
      />
    );
  },
  PAYMENT_METHOD: (props) => {
    return (
      <MultipleSelect
        options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
        {...props}
      />
    );
  },
  TRANSACTION_TYPES: (props) => {
    return (
      <MultipleSelect
        options={TRANSACTION_TYPES.map((type) => ({ value: type, label: type }))}
        {...props}
      />
    );
  },
  RANGE: ({ disabled, values, onChange }) => {
    const range = (values[0] ?? '0,0').split(',').map((x) => parseInt(x) || 0);
    return (
      <>
        <Slider
          range
          marks={range.reduce((acc, x) => ({ ...acc, [x]: x }), {})}
          endExclusive={true}
          value={[range[0], range[1]]}
          disabled={disabled}
          onChange={(value) => {
            onChange([value.map((x) => `${x}`).join(',')]);
          }}
        />
      </>
    );
  },
};

export const VALUE_RENDERERS: { [key in DataTypes]: ValueRenderer } = {
  STRING: ({ value }) => <span>{value}</span>,
  CURRENCY: ({ value }) => (
    <span>{CURRENCIES_SELECT_OPTIONS.find((currency) => currency.value === value)?.label}</span>
  ),
  COUNTRY: ({ value }) => {
    if (value == null) {
      return null;
    }
    return <span>{COUNTRIES[value]}</span>;
  },
  BUSINESS_REGISTRATION_COUNTRY: ({ value }) => {
    if (value == null) {
      return null;
    }
    return <span>{COUNTRIES[value]}</span>;
  },
  PAYMENT_METHOD: ({ value }) => <span>{value}</span>,
  TRANSACTION_TYPES: ({ value }) => <span>{value}</span>,
  CONSUMER_USER_TYPE: ({ value }) => {
    if (value == null) {
      return null;
    }
    return <span>{value}</span>;
  },
  BUSINESS_USER_TYPE: ({ value }) => {
    if (value == null) {
      return null;
    }
    return <span>{value}</span>;
  },
  RANGE: ({ value }) => {
    const range = value?.split(',').map((x) => parseInt(x)) ?? [];
    return (
      <Slider
        range
        endExclusive={true}
        marks={range.reduce((acc, x) => ({ ...acc, [x]: x }), {})}
        defaultValue={[range[0] ?? 0, range[1] ?? 0]}
        disabled={true}
      />
    );
  },
};

type Validation = (params: {
  newParameterName: ParameterName;
  newValue: string[];
  newRiskLevel: RiskLevel | null;
  previousValues: ParameterValues;
}) => null | string;

export const NEW_VALUE_VALIDATIONS: Validation[] = [
  ({ newParameterName, newValue, previousValues }) => {
    if (
      newParameterName === 'userDetails.dateOfBirth' ||
      newParameterName === 'legalEntity.companyRegistrationDetails.dateOfRegistration'
    ) {
      for (const valueItem of newValue) {
        const [x1, x2] = valueItem.split(',').map((x) => parseInt(x));
        const hasOverlaps = previousValues.some(({ parameterValue }) => {
          const [y1, y2] = parameterValue.split(',').map((x) => parseInt(x));
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
