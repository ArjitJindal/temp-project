import React, { useEffect, useState } from 'react';
import { humanizeAuto, humanizeCamelCase, humanizeConstant } from '@flagright/lib/utils/humanize';
import Money from '../Money';
import s from './index.module.less';
import * as Form from '@/components/ui/Form';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import Address from '@/components/ui/Address';
import BankDetails from '@/components/ui/BankDetails';
import {
  Address as ApiAddress,
  CardExpiry,
  CardMerchantDetails,
  ConsumerName,
  Tag as ApiTag,
  CurrencyCode,
  UserDetails,
  CorrespondentBankDetails,
} from '@/apis';
import { notNullish } from '@/utils/array';
import { getPaymentMethodTitle, PaymentMethod } from '@/utils/payments';
import { formatConsumerName } from '@/utils/api/users/helpers';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { PaymentDetails, PaymentDetailsKey } from '@/utils/api/payment-details';
import GeneralDetails from '@/pages/users-item/UserDetails/BusinessUserDetails/PersonsCard/PersonDetails/GeneralDetails';

interface Props {
  paymentDetails: PaymentDetails | undefined;
  currentRef?: React.RefObject<HTMLDivElement>;
  otherRef?: React.RefObject<HTMLDivElement>;
}

export default function PaymentDetailsProps(props: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const { paymentDetails, currentRef, otherRef } = props;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const height = Math.max(
        otherRef?.current?.clientHeight ?? 0,
        currentRef?.current?.clientHeight ?? 0,
      );
      setHeight(height);
    }, 100);
    return () => clearTimeout(timeout);
  }, [currentRef, otherRef]);

  const entries = paymentDetails
    ? (Object.entries(paymentDetails) as [PaymentDetailsKey, unknown][])
    : [];
  return (
    <div
      className={s.root}
      ref={currentRef}
      style={{
        height: height ? `${height}px` : `auto`,
      }}
    >
      {entries.length === 0 && '-'}
      {paymentDetails
        ? entries.map(([key, value]) => (
            <Form.Layout.Label
              key={key}
              orientation="vertical"
              title={humanizeCamelCase(key)}
              className={s.property}
            >
              {renderValue(key, value, paymentDetails.method)}
            </Form.Layout.Label>
          ))
        : '-'}
    </div>
  );
}

function renderValue(
  key: PaymentDetailsKey,
  value: unknown,
  method: PaymentMethod,
): React.ReactNode {
  if (value == null) {
    return '-';
  }
  if (key === 'method') {
    return getPaymentMethodTitle(value as PaymentMethod);
  }
  if (key === 'cardIssuedCountry' || key === 'country') {
    return <CountryDisplay isoCode={value as string} />;
  }
  if (key === 'cardBalance' || key === 'walletBalance' || key === 'accountBalance') {
    const cardBalance = value as {
      amountValue?: number;
      amountCurrency?: string;
      [key: string]: unknown;
    };
    return (
      <div>
        {Object.entries(cardBalance)
          .filter(([_, val]) => val != null)
          .map(([balanceKey, balanceValue]) => {
            if (balanceKey === 'amountValue' && cardBalance.amountCurrency) {
              return (
                <div key={balanceKey}>
                  <Money
                    amount={{
                      amountValue: balanceValue as number,
                      amountCurrency: cardBalance.amountCurrency as CurrencyCode,
                    }}
                  />
                </div>
              );
            }

            if (balanceKey === 'amountCurrency') {
              return null;
            }

            return (
              <div key={balanceKey}>
                {humanizeCamelCase(balanceKey)}: {stringifyValue(balanceValue)}
              </div>
            );
          })}
      </div>
    );
  }
  if (
    key === 'deliveryStatus' ||
    key === 'cardType' ||
    key === 'cardFunding' ||
    key === 'accountType'
  ) {
    return humanizeConstant(value as string);
  }
  if (key === 'cardExpiry') {
    const cardExpiry = value as CardExpiry;
    return `${cardExpiry.year ?? '-'} / ${cardExpiry.month?.toString().padStart(2, '0') ?? '-'}`;
  }
  if (key === 'nameOnCard') {
    const name = value as ConsumerName;
    return formatConsumerName(name);
  }
  if (key === 'name') {
    if (method === 'NPP') {
      const name = value as ConsumerName;
      return formatConsumerName(name);
    }
    return humanizeAuto(value as string);
  }
  if (key === 'merchantDetails') {
    const merchandDetails = value as CardMerchantDetails;
    return Object.entries(merchandDetails)
      .filter(([_, value]) => value != null)
      .map(([key, value]) => `${humanizeCamelCase(key)}: ${value}`)
      .join(', ');
  }
  if (key === 'tags') {
    const tags: ApiTag[] = Array.isArray(value) ? value : [value];
    return tags.filter(notNullish).map((tag) => <KeyValueTag key={tag.key} tag={tag} />);
  }
  if (['bankAddress', 'shippingAddress', 'billingAddress', 'address'].includes(key)) {
    const address = value as ApiAddress;
    return <Address address={address} />;
  }

  if (key === 'authorizedRepresentative') {
    const authorizedRepresentative = value as UserDetails[];
    return authorizedRepresentative.map((representative) => (
      <GeneralDetails key={representative.name?.firstName} generalDetails={representative} />
    ));
  }

  if (key === 'correspondentBankDetails') {
    const correspondentBankDetails = value as CorrespondentBankDetails[];
    return correspondentBankDetails.map((correspondenceBankDetail) => (
      <BankDetails key={correspondenceBankDetail.bankName} bankDetails={correspondenceBankDetail} />
    ));
  }

  return stringifyValue(value);
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return '-';
  }
  if (isSimpleValue(value)) {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(', ');
  }
  return JSON.stringify(value);
}

function isSimpleValue(value: unknown): value is string | number | boolean {
  const valueType = typeof value;
  return valueType === 'string' || valueType === 'number' || valueType === 'boolean';
}
