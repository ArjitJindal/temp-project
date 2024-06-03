import React from 'react';
import s from './index.module.less';
import {
  IBANDetails,
  GenericBankAccountDetails,
  InternalBusinessUser,
  InternalConsumerUser,
} from '@/apis';
import * as Card from '@/components/ui/Card';
import AccountPinCircleLineIcon from '@/components/ui/icons/Remix/user/account-pin-circle-line.react.svg';
import AccountBoxLineIcon from '@/components/ui/icons/Remix/user/account-box-line.react.svg';
import FlagLineIcon from '@/components/ui/icons/Remix/business/flag-line.react.svg';
import FileListIcon from '@/components/ui/icons/Remix/document/file-list-line.react.svg';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
}

export function BankDetails(prop: Props) {
  const { user } = prop;
  const showBicCodeColumn =
    user.savedPaymentDetails?.filter(
      (paymentDetail) => paymentDetail.method === 'IBAN' && paymentDetail.BIC !== undefined,
    ).length !== 0;
  return (
    <Card.Column>
      <Card.Row className={s.header}>
        <Card.Subtitle className={s.title} icon={<AccountPinCircleLineIcon />} title="Bank name" />
        <Card.Subtitle className={s.title} icon={<AccountBoxLineIcon />} title="Account number" />
        <Card.Subtitle className={s.title} icon={<FlagLineIcon />} title="Country code" />
        {showBicCodeColumn && (
          <Card.Subtitle className={s.title} icon={<FileListIcon />} title="BIC code" />
        )}
      </Card.Row>
      <div className={s.root}>
        {(user.savedPaymentDetails ?? [])
          .filter((details): details is IBANDetails | GenericBankAccountDetails => {
            return details.method === 'IBAN' || details.method === 'GENERIC_BANK_ACCOUNT';
          })
          .map((details, i) => {
            const isIBAN = details.method === 'IBAN';
            return (
              <div className={s.row} key={i}>
                <div className={s.cell}>{details.bankName ?? '-'}</div>
                <div className={s.cell}>{isIBAN ? details.IBAN : details.accountNumber}</div>
                <div className={s.cell}>{isIBAN ? details.country ?? '-' : '-'}</div>
                {showBicCodeColumn && (
                  <div className={s.cell}>{isIBAN ? details.BIC ?? '-' : '-'}</div>
                )}
              </div>
            );
          })}
      </div>
    </Card.Column>
  );
}
