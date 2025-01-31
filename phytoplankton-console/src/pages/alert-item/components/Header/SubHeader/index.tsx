import React from 'react';
import s from './index.module.less';
import AlertAssigneesDropdown from './AlertAssigneesDropdown';
import { Alert, Case } from '@/apis';
import * as Form from '@/components/ui/Form';
import { neverReturn } from '@/utils/lang';
import Id from '@/components/ui/Id';
import { getUserLink, getUserName } from '@/utils/api/users';
import { getPaymentMethodTitle } from '@/utils/payments';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { AsyncResource } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import RuleQueueTag from '@/components/library/Tag/RuleQueueTag';
import StatusChangeReasonsDisplay from '@/components/ui/StatusChangeReasonsDisplay';
import Spinner from '@/components/library/Spinner';

interface Props {
  caseItemRes: AsyncResource<Case>;
  alertItem: Alert;
}

export default function SubHeader(props: Props) {
  const { alertItem, caseItemRes } = props;

  const renderLabels = (caseItem: Case | null) => {
    if (caseItem == null) {
      return <Spinner />;
    }
    return caseItem.subjectType === 'PAYMENT'
      ? paymentSubjectLabels(caseItem)
      : userSubjectLabels(caseItem);
  };
  return (
    <div className={s.root}>
      <div className={s.attributes}>
        <AsyncResourceRenderer resource={caseItemRes} renderLoading={renderLabels}>
          {renderLabels}
        </AsyncResourceRenderer>
        <Form.Layout.Label title={'Assigned to'}>
          <AlertAssigneesDropdown alertItem={alertItem} />
        </Form.Layout.Label>
        <Form.Layout.Label title={'Alert queue'}>
          <RuleQueueTag queueId={alertItem.ruleQueueId} />
        </Form.Layout.Label>
        <Form.Layout.Label title={'Created at'}>
          {dayjs(alertItem.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>
        <Form.Layout.Label title={'Last updated'}>
          {dayjs(alertItem.updatedAt).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>
        {alertItem.lastStatusChange && (
          <Form.Layout.Label title={'Status change reasons'}>
            <StatusChangeReasonsDisplay
              reasons={alertItem.lastStatusChange.reason}
              otherReason={alertItem.lastStatusChange.otherReason}
            />
          </Form.Layout.Label>
        )}
      </div>
    </div>
  );
}

function paymentSubjectLabels(caseItem: Case) {
  const paymentDetails =
    caseItem.paymentDetails?.origin ?? caseItem.paymentDetails?.destination ?? undefined;
  const specialFields: {
    label: string;
    value: string | undefined;
  }[] = [];
  if (paymentDetails == null) {
    // noop
  } else if (paymentDetails.method === 'CARD') {
    if (paymentDetails.cardLast4Digits) {
      specialFields.push({
        label: 'Card last 4 digits',
        value: paymentDetails.cardLast4Digits,
      });
    } else if (paymentDetails.cardFingerprint) {
      specialFields.push({
        label: 'Card fingerprint',
        value: paymentDetails.cardFingerprint,
      });
    }
  } else if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
    specialFields.push({
      label: 'Bank account number',
      value: paymentDetails.accountNumber,
    });
  } else if (paymentDetails.method === 'IBAN') {
    specialFields.push({
      label: 'IBAN',
      value: paymentDetails.IBAN,
    });
  } else if (paymentDetails.method === 'ACH') {
    specialFields.push({
      label: 'ACH account number',
      value: paymentDetails.accountNumber,
    });
  } else if (paymentDetails.method === 'SWIFT') {
    specialFields.push({
      label: 'SWIFT account number',
      value: paymentDetails.accountNumber,
    });
  } else if (paymentDetails.method === 'MPESA') {
    specialFields.push({
      label: 'MPESA business code',
      value: paymentDetails.businessShortCode,
    });
  } else if (paymentDetails.method === 'UPI') {
    specialFields.push({
      label: 'UPI ID',
      value: paymentDetails.upiID,
    });
  } else if (paymentDetails.method === 'WALLET') {
    specialFields.push({
      label: 'Wallet ID',
      value: paymentDetails.walletId,
    });
  } else if (paymentDetails.method === 'CHECK') {
    specialFields.push({
      label: 'Check identifier/number',
      value: [paymentDetails.checkIdentifier, paymentDetails.checkNumber]
        .map((x) => x || '-')
        .join('/'),
    });
  } else if (paymentDetails.method === 'CASH') {
    specialFields.push({
      label: 'Cash identifier/number',
      value: paymentDetails.identifier,
    });
  } else {
    neverReturn(paymentDetails, '-');
  }
  return (
    <>
      <Form.Layout.Label title={'Payment identifier'}>
        {paymentDetails != null ? getPaymentMethodTitle(paymentDetails.method) : '-'}
      </Form.Layout.Label>
      {specialFields.map(({ label, value }) => (
        <Form.Layout.Label key={label} title={label}>
          {value || '-'}
        </Form.Layout.Label>
      ))}
    </>
  );
}

function userSubjectLabels(caseItem: Case) {
  const caseUser = (caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined) as
    | TableUser
    | undefined;

  return (
    <>
      <Form.Layout.Label title={'User name'}>{getUserName(caseUser)}</Form.Layout.Label>
      <Form.Layout.Label title={'User ID'}>
        <Id to={getUserLink(caseUser)} toNewTab alwaysShowCopy>
          {caseUser?.userId}
        </Id>
      </Form.Layout.Label>
    </>
  );
}
