import React from 'react';
import { COUNTRIES, CURRENCIES } from '@flagright/lib/constants';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { RiskLevelTableItem } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/types';
import { RiskEntityType, RiskFactorDataType, RiskFactorParameter, TransactionType } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import { PaymentMethod, getPaymentMethodTitle } from '@/utils/payments';
import TransactionTypeDisplay from '@/components/library/TransactionTypeDisplay';
import { ALL_RISK_PARAMETERS } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';
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

export const PARAMETER_RENDERERS: Record<RiskFactorDataType, ParameterRenderer<any>> = {
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
  BUSINESS_USER_SEGMENT: CONSTANT_RENDERER,
  CONSUMER_USER_SEGMENT: CONSTANT_RENDERER,
  CONSUMER_EMPLOYMENT_STATUS: CONSTANT_RENDERER,
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
  CARD_3DS_STATUS: DEFAULT_RENDERER,
  SOURCE_OF_FUNDS: DEFAULT_RENDERER,
  AMOUNT_RANGE: DEFAULT_RENDERER,
};

export function findParameter(
  entity: RiskEntityType,
  parameter: RiskFactorParameter,
): RiskLevelTableItem | null {
  const parameterDescription = ALL_RISK_PARAMETERS.find(
    (x) => x.entity === entity && x.parameter === parameter,
  );
  return parameterDescription ?? null;
}
