import React from 'react';
import cn from 'clsx';
import { capitalize } from 'lodash';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import {
  ACHDetails,
  CardDetails,
  GenericBankAccountDetails,
  IBANDetails,
  SWIFTDetails,
  UPIDetails,
  WalletDetails,
  MpesaDetails,
} from '@/apis';

export type PaymentDetails =
  | CardDetails
  | GenericBankAccountDetails
  | IBANDetails
  | ACHDetails
  | UPIDetails
  | WalletDetails
  | SWIFTDetails
  | MpesaDetails;

interface Props {
  paymentDetails: PaymentDetails | undefined;
}

function humanizePropertyName(key: string): string {
  const parts = key.match(/(^|[A-Z])[a-z]*/g);
  if (parts == null) {
    return '';
  }
  return parts.map(capitalize).join(' ');
}

function Property(props: { name: string[]; value: unknown }) {
  const { name, value } = props;

  const humanizedName = name.map(humanizePropertyName).join(' / ');
  if (value != null) {
    if (Array.isArray(value)) {
      return (
        <>
          <div className={s.propertyName}>{humanizedName}</div>
          <div className={s.propertyValue}>{value.join(', ')}</div>
        </>
      );
    } else if (typeof value === 'object') {
      return (
        <>
          {Object.entries(value).map(([entryKey, entryValue]) => (
            <Property key={entryKey} name={[...name, entryKey]} value={entryValue} />
          ))}
        </>
      );
    }
  }

  return (
    <>
      <div className={s.propertyName}>{humanizedName}</div>
      <div className={s.propertyValue}>{`${value}`}</div>
    </>
  );
}

export default function PaymentDetails(props: Props) {
  const { paymentDetails } = props;
  return (
    <Card.Root className={cn(s.root)}>
      <Card.Section>
        <div>
          <P variant="sml" bold>
            Payment Details
          </P>
        </div>
        {paymentDetails == null ? (
          <P className={s.empty} variant="sml" bold>
            No payment details available
          </P>
        ) : (
          <div className={s.properties}>
            {Object.entries(paymentDetails).map(([key, value]) => (
              <Property key={key} name={[key]} value={value} />
            ))}
          </div>
        )}
      </Card.Section>
    </Card.Root>
  );
}
