import React from 'react';
import { CURRENCIES, Currency } from '@flagright/lib/constants';
import { Amount, TransactionAmountDetails } from '@/apis';
import { formatNumber } from '@/utils/number';
import CurrencySymbol from '@/components/ui/Currency';

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

interface AmountProps {
  transactionAmount?: TransactionAmountDetails;
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
  } else if ('amount' in props) {
    value = props.amount?.amountValue;
    currency = props.amount?.amountCurrency as Currency | undefined;
  } else if ('transactionAmount' in props) {
    value = props.transactionAmount?.transactionAmount;
    currency = props.transactionAmount?.transactionCurrency as Currency | undefined;
  }
  const { compact = false, ...rest } = props;

  if (value == null || currency == null) {
    return <span {...rest}>-</span>;
  }

  const currencyInfo = CURRENCIES.find((x) => x.value === currency) ?? null;
  if (currencyInfo == null) {
    return (
      <span {...rest}>
        <span title={(value ?? 0.0)?.toFixed(2)}>{formatNumber(value, { compact })}</span>
        <span> </span>
        <span>{currency}</span>
      </span>
    );
  }
  return (
    <span {...rest}>
      <CurrencySymbol currency={currency} />
      &#8203;
      <span title={(value ?? 0.0)?.toFixed(2)}>{formatNumber(value, { compact })}</span>
    </span>
  );
}
