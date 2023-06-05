import React from 'react';
import s from './index.module.less';
import { IBANDetails, GenericBankAccountDetails, InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import AccountPinCircleLineIcon from '@/components/ui/icons/Remix/user/account-pin-circle-line.react.svg';
import AccountBoxLineIcon from '@/components/ui/icons/Remix/user/account-box-line.react.svg';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';

interface Props {
  user: InternalBusinessUser;
}

export function BankDetails(prop: Props) {
  const { user } = prop;
  return (
    <Card.Column>
      <Card.Row className={s.header}>
        <Card.Subtitle className={s.title} icon={<AccountPinCircleLineIcon />} title="Bank name" />
        <Card.Subtitle
          className={s.title}
          icon={<AccountBoxLineIcon />}
          title="Bank account number"
        />
      </Card.Row>
      <Card.Section className={s.root}>
        <PropertyColumns>
          {(user.savedPaymentDetails ?? [])
            .filter((details): details is IBANDetails | GenericBankAccountDetails => {
              return details.method === 'IBAN' || details.method === 'GENERIC_BANK_ACCOUNT';
            })
            .map((details, i) => (
              <React.Fragment key={i}>
                <div>{details.bankName}</div>
                <div>{details.method === 'IBAN' ? details.IBAN : details.accountNumber}</div>
              </React.Fragment>
            ))}
        </PropertyColumns>
      </Card.Section>
    </Card.Column>
  );
}
