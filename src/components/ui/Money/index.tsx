import React from 'react';
import { CURRENCIES, Currency, CurrencyInfo } from '@/utils/currencies';
import { Amount } from '@/apis';

interface CommonProps {
  compact?: boolean;
}

interface ValueCurrencyProps {
  currency: Currency;
  value: number | null | undefined;
}

interface AmountProps {
  amount?: Amount;
}

type Props = (AmountProps | ValueCurrencyProps) &
  CommonProps &
  React.HTMLAttributes<HTMLSpanElement>;

export default function Money(props: Props) {
  let value: number | null | undefined;
  let currency: Currency | null | undefined;
  if ('value' in props && 'currency' in props) {
    value = props.value;
    currency = props.currency;
  } else {
    value = props.amount?.amountValue;
    currency = props.amount?.amountCurrency as Currency | undefined;
  }
  const { compact = false, ...rest } = props;

  if (value == null || currency == null) {
    return <span {...rest}>-</span>;
  }

  const currencyInfo = CURRENCIES.find((x) => x.value === currency) ?? null;
  if (currencyInfo == null) {
    return (
      <span {...rest}>
        <span title={value.toFixed(2)}>{formatNumber(value, compact)}</span>
        <span> </span>
        <span>{currency}</span>
      </span>
    );
  }
  return (
    <span {...rest}>
      <CurrencySymbol currencyInfo={currencyInfo} currency={currency} />
      &#8203;
      <span title={value.toFixed(2)}>{formatNumber(value, compact)}</span>
    </span>
  );
}

function CurrencySymbol(props: { currency: Currency; currencyInfo: CurrencyInfo }) {
  const { currencyInfo } = props;
  return (
    <span title={`${currencyInfo.label}`}>{currencyInfo?.symbol ?? `${currencyInfo?.value} `}</span>
  );
}

function formatNumber(amount: number, compact = false): string {
  let formattedNumber = `${amount.toFixed(2)}`;
  if (compact) {
    if (amount >= 1000) {
      formattedNumber = `${Math.round(amount / 10) / 100}`;
    }
    if (amount >= 1000000) {
      formattedNumber = `${Math.round(amount / 10000) / 100}`;
    }
  }

  formattedNumber = new Intl.NumberFormat().format(Number(formattedNumber));

  if (compact && amount >= 1000) {
    formattedNumber = `${formattedNumber}k`;
  }

  return formattedNumber;
}
