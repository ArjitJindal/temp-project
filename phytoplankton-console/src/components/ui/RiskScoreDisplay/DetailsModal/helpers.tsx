import React from 'react';
import {
  DataType,
  ParameterName,
  RiskLevelTableItem,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { RiskEntityType, TransactionType } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { PaymentMethod } from '@/utils/payments';
import TransactionTypeTag from '@/components/library/TransactionTypeTag';
import { humanizeConstant } from '@/utils/humanize';
import { CURRENCIES } from '@/utils/currencies';
import {
  ALL_RISK_PARAMETERS,
  BUSINESS_USER_SEGMENT_OPTIONS,
  CONSUMER_EMPLOYMENT_STATUS_OPTIONS,
  CONSUMER_USER_SEGMENT_OPTIONS,
} from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import TimestampDisplay from '@/components/ui/TimestampDisplay';

export type ParameterRenderer<V> = (value: V) => React.ReactNode;

export const DEFAULT_RENDERER: ParameterRenderer<unknown> = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return <>{`${value}`}</>;
  }

  if (typeof value === 'boolean') {
    return <>{value ? 'Yes' : 'No'}</>;
  }
  return <>{JSON.stringify(value)}</>;
};

export const CONSTANT_RENDERER: ParameterRenderer<string> = (value) => {
  return humanizeConstant(value);
};

export const PARAMETER_RENDERERS: { [key in DataType]: ParameterRenderer<any> } = {
  STRING: DEFAULT_RENDERER,
  CURRENCY: ((value) => {
    return CURRENCIES.find((x) => x.value === value)?.label ?? value;
  }) as ParameterRenderer<string>,
  COUNTRY: ((value) => {
    return <CountryDisplay isoCode={value} />;
  }) as ParameterRenderer<string>,
  PAYMENT_METHOD: ((value) => {
    return <PaymentMethodTag paymentMethod={value} />;
  }) as ParameterRenderer<PaymentMethod>,
  BUSINESS_INDUSTRY: CONSTANT_RENDERER,
  TRANSACTION_TYPES: ((value) => {
    return <TransactionTypeTag transactionType={value} />;
  }) as ParameterRenderer<TransactionType>,
  RESIDENCE_TYPES: CONSTANT_RENDERER,
  CONSUMER_USER_TYPE: CONSTANT_RENDERER,
  BUSINESS_USER_TYPE: CONSTANT_RENDERER,
  BANK_NAMES: CONSTANT_RENDERER,
  BUSINESS_USER_SEGMENT: (value) => {
    return BUSINESS_USER_SEGMENT_OPTIONS.find((x) => x.value === value)?.label ?? value;
  },
  CONSUMER_USER_SEGMENT: (value) => {
    return CONSUMER_USER_SEGMENT_OPTIONS.find((x) => x.value === value)?.label ?? value;
  },
  CONSUMER_EMPLOYMENT_STATUS: (value) => {
    return CONSUMER_EMPLOYMENT_STATUS_OPTIONS.find((x) => x.value === value)?.label ?? value;
  },
  USER_REGISTRATION_STATUS: DEFAULT_RENDERER,
  RANGE: DEFAULT_RENDERER,
  DAY_RANGE: DEFAULT_RENDERER,
  TIME_RANGE: (value) => {
    return <TimestampDisplay timestamp={value} />;
  },
  BOOLEAN: DEFAULT_RENDERER,
  _3DS_STATUS: DEFAULT_RENDERER,
  SOURCE_OF_FUNDS: DEFAULT_RENDERER,
};

export function findParameter(
  entity: RiskEntityType,
  parameter: ParameterName,
): RiskLevelTableItem | null {
  const parameterDescription = ALL_RISK_PARAMETERS.find(
    (x) => x.entity === entity && x.parameter === parameter,
  );
  return parameterDescription ?? null;
}
