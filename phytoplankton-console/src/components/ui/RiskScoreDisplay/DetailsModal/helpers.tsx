import React from 'react';
import { COUNTRIES, CURRENCIES } from '@flagright/lib/constants';
import {
  DataType,
  ParameterName,
  RiskLevelTableItem,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { RiskEntityType, TransactionType } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import { PaymentMethod, getPaymentMethodTitle } from '@/utils/payments';
import TransactionTypeDisplay from '@/components/library/TransactionTypeDisplay';
import { humanizeConstant } from '@/utils/humanize';
import {
  ALL_RISK_PARAMETERS,
  BUSINESS_USER_SEGMENT_OPTIONS,
  CONSUMER_EMPLOYMENT_STATUS_OPTIONS,
  CONSUMER_USER_SEGMENT_OPTIONS,
} from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';

export type ParameterRenderer<V> = (value: V) => {
  renderer: React.ReactNode;
  stringify: string;
};

export const DEFAULT_RENDERER: ParameterRenderer<string> = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return {
      renderer: <>{value}</>,
      stringify: `${value}`,
    };
  }

  if (typeof value === 'boolean') {
    return {
      renderer: <>{value ? 'Yes' : 'No'}</>,
      stringify: `${value}`,
    };
  }
  return {
    stringify: JSON.stringify(value),
    renderer: <>{JSON.stringify(value)}</>,
  };
};

export const CONSTANT_RENDERER: ParameterRenderer<string> = (value) => {
  return {
    stringify: humanizeConstant(value),
    renderer: <>{humanizeConstant(value)}</>,
  };
};

export const PARAMETER_RENDERERS: { [key in DataType]: ParameterRenderer<any> } = {
  STRING: DEFAULT_RENDERER,
  CURRENCY: ((value) => {
    const valueLabel = CURRENCIES.find((x) => x.value === value)?.label ?? value;
    return {
      stringify: value,
      renderer: <>{valueLabel}</>,
    };
  }) as ParameterRenderer<string>,
  COUNTRY: ((value) => {
    return {
      renderer: <CountryDisplay isoCode={value} />,
      stringify: COUNTRIES[value] ?? value,
    };
  }) as ParameterRenderer<string>,
  PAYMENT_METHOD: ((value) => {
    return {
      renderer: <PaymentMethodTag paymentMethod={value} />,
      stringify: value ? getPaymentMethodTitle(value) : '-',
    };
  }) as ParameterRenderer<PaymentMethod>,
  BUSINESS_INDUSTRY: CONSTANT_RENDERER,
  TRANSACTION_TYPES: ((value) => {
    return {
      renderer: <TransactionTypeDisplay transactionType={value} />,
      stringify: humanizeConstant(value),
    };
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
    return {
      renderer: <TimestampDisplay timestamp={value} />,
      stringify: dayjs(value).format(DATE_TIME_FORMAT_WITHOUT_SECONDS),
    };
  },
  BOOLEAN: DEFAULT_RENDERER,
  _3DS_STATUS: DEFAULT_RENDERER,
  SOURCE_OF_FUNDS: DEFAULT_RENDERER,
  AMOUNT_RANGE: DEFAULT_RENDERER,
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
