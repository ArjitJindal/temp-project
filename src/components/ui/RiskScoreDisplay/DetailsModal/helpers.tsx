import React from 'react';
import { DataType } from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { PaymentMethod } from '@/utils/payments';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { humanizeConstant } from '@/utils/humanize';
import { TransactionType } from '@/apis';
import { CURRENCIES } from '@/utils/currencies';
import { USER_SEGMENT_OPTIONS } from '@/pages/risk-levels/risk-factors/ParametersTable/consts';

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
  USER_SEGMENT: (value) => {
    return USER_SEGMENT_OPTIONS.find((x) => x.value === value)?.label ?? value;
  },
  USER_REGISTRATION_STATUS: DEFAULT_RENDERER,
  RANGE: DEFAULT_RENDERER,
  DAY_RANGE: DEFAULT_RENDERER,
  TIME_RANGE: DEFAULT_RENDERER,
  BOOLEAN: DEFAULT_RENDERER,
};
