import React from 'react';
import { CURRENCIES, Currency } from '@flagright/lib/constants';
import { CurrencyCode } from '@/apis';

interface Props {
  currency: CurrencyCode | Currency | undefined;
}

export default function CurrencySymbol(props: Props) {
  const { currency } = props;

  const currencyInfo = CURRENCIES.find((x) => x.value === currency) ?? null;
  if (currencyInfo == null) {
    return <>{currency}</>;
  }
  return (
    <span title={`${currencyInfo.label}`}>{currencyInfo?.symbol ?? `${currencyInfo?.value} `}</span>
  );
}
