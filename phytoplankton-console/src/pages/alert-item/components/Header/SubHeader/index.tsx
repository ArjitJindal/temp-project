import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import AlertAssigneesDropdown from './AlertAssigneesDropdown';
import { Alert, Case } from '@/apis';
import * as Form from '@/components/ui/Form';
import { neverReturn } from '@/utils/lang';
import Id from '@/components/ui/Id';
import { getUserLink, getUserName } from '@/utils/api/users';
import { getPaymentMethodTitle } from '@/utils/payments';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import RuleQueueTag from '@/components/library/Tag/RuleQueueTag';
import StatusChangeReasonsDisplay from '@/components/ui/StatusChangeReasonsDisplay';
import Spinner from '@/components/library/Spinner';
import Skeleton from '@/components/library/Skeleton';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  caseItemRes: AsyncResource<Case>;
  alertItemRes: AsyncResource<Alert>;
}

export default function SubHeader(props: Props) {
  const { alertItemRes, caseItemRes } = props;
  const settings = useSettings();

  const renderLabels = (caseItem: Case | null) => {
    if (caseItem == null) {
      return <Spinner />;
    }
    return caseItem.subjectType === 'PAYMENT'
      ? paymentSubjectLabels(caseItem)
      : userSubjectLabels(caseItem, firstLetterUpper(settings.userAlias));
  };
  return (
    <div className={s.root}>
      <div className={s.attributes}>
        <AsyncResourceRenderer resource={caseItemRes} renderLoading={renderLabels}>
          {renderLabels}
        </AsyncResourceRenderer>
        <Form.Layout.Label title={'Assigned to'}>
          <Skeleton res={alertItemRes}>
            {(alertItem) => <AlertAssigneesDropdown alertItem={alertItem} />}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title={'Alert queue'}>
          <Skeleton res={alertItemRes}>
            {(alertItem) => <RuleQueueTag queueId={alertItem.ruleQueueId} />}
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title={'Created at'}>
          <Skeleton res={alertItemRes}>
            {(alertItem) =>
              dayjs(alertItem.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)
            }
          </Skeleton>
        </Form.Layout.Label>
        <Form.Layout.Label title={'Last updated'}>
          <Skeleton res={alertItemRes}>
            {(alertItem) => dayjs(alertItem.updatedAt).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
          </Skeleton>
        </Form.Layout.Label>
        {isSuccess(alertItemRes) && alertItemRes.value.lastStatusChange && (
          <Form.Layout.Label title={'Status change reasons'}>
            <StatusChangeReasonsDisplay
              reasons={alertItemRes.value.lastStatusChange.reason}
              otherReason={alertItemRes.value.lastStatusChange.otherReason}
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
  } else if (paymentDetails.method === 'NPP') {
    specialFields.push({
      label: 'NPP ID',
      value: paymentDetails.endToEndId,
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

function userSubjectLabels(caseItem: Case, userAlias: string) {
  const caseUser = (caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined) as
    | TableUser
    | undefined;

  return (
    <>
      <Form.Layout.Label title={`${userAlias} name`}>{getUserName(caseUser)}</Form.Layout.Label>
      <Form.Layout.Label title={`${userAlias} ID`}>
        <Id to={getUserLink(caseUser)} toNewTab alwaysShowCopy>
          {caseUser?.userId}
        </Id>
      </Form.Layout.Label>
    </>
  );
}
