import React from 'react';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { PaymentDetails } from '@/pages/transactions-item/UserDetails/PaymentDetails';
import * as Form from '@/components/ui/Form';
import { humanizeCamelCase, humanizeConstant } from '@/utils/humanize';
import KeyValueTag from '@/components/ui/KeyValueTag';
import Address from '@/components/ui/Address';
import {
  Address as ApiAddress,
  CardExpiry,
  ConsumerName,
  Tag as ApiTag,
  CardMerchantDetails,
} from '@/apis';
import { notNullish } from '@/utils/array';
import { getPaymentMethodTitle, PaymentMethod } from '@/utils/payments';
import { formatConsumerName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  paymentDetails: PaymentDetails | undefined;
}

export default function PaymentIdentifierDetailsCard(props: Props) {
  const { paymentDetails } = props;

  const entries = paymentDetails ? Object.entries(paymentDetails) : [];

  return (
    <Card.Root>
      <Card.Section>
        <div className={s.root}>
          {entries.length === 0 && '-'}
          {paymentDetails
            ? entries.map(([key, value]) => (
                <Form.Layout.Label
                  key={key}
                  orientation="vertical"
                  title={humanizeCamelCase(key)}
                  className={s.property}
                >
                  {renderValue(key, value)}
                </Form.Layout.Label>
              ))
            : '-'}
        </div>
      </Card.Section>
    </Card.Root>
  );
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value == null) {
    return '-';
  }
  if (key === 'method') {
    return getPaymentMethodTitle(value as PaymentMethod);
  }
  if (key === 'cardIssuedCountry' || key === 'country') {
    return <CountryDisplay isoCode={value as string} />;
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
  if (key === 'bankAddress' || key === 'shippingAddress') {
    const address = value as ApiAddress;
    return <Address address={address} />;
  }
  return stringifyValue(value);
}

function stringifyValue(value: unknown): string {
  if (isSimpleValue(value)) {
    return value == null ? '-' : `${value}`;
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(', ');
  }
  return JSON.stringify(value);
}

function isSimpleValue(value: unknown): value is string | number | boolean | null | undefined {
  if (value == null) {
    return true;
  }
  const valueType = typeof value;
  return valueType === 'string' || valueType === 'number' || valueType === 'boolean';
}
