import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import { message } from '@/components/library/Message';
import { Assignment, Case, CaseStatus } from '@/apis';
import { useApi } from '@/api';
import * as Form from '@/components/ui/Form';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import KycRiskDisplay from '@/pages/users-item/UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '@/pages/users-item/UserDetails/DynamicRiskDisplay';
import { CASES_ITEM } from '@/utils/queries/keys';
import { getErrorMessage, neverReturn } from '@/utils/lang';
import { useUpdateCaseQueryData } from '@/utils/api/cases';
import { isOnHoldOrInProgress, statusEscalated, statusInReview } from '@/utils/case-utils';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { getUserLink, getUserName } from '@/utils/api/users';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { getPaymentMethodTitle } from '@/utils/payments';
import AIRiskDisplay from '@/components/ui/AIRiskDisplay';
import { TableUser } from '@/pages/case-management/CaseTable/types';

interface Props {
  caseItem: Case;
}

export default function SubHeader(props: Props) {
  const { caseItem } = props;
  const { caseId } = caseItem;

  const api = useApi();
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const { subjectType = 'USER', caseUsers } = caseItem;
  const isUserSubject = subjectType === 'USER';
  let caseUser;
  if (isUserSubject && caseUsers) {
    caseUser = caseUsers?.origin ?? caseUsers?.destination;
  }
  const isCaseEscalated = statusEscalated(caseItem.caseStatus);
  const isCaseInReview = useMemo(() => statusInReview(caseItem.caseStatus), [caseItem.caseStatus]);
  const otherStatuses = useMemo(
    () => isOnHoldOrInProgress(caseItem.caseStatus as CaseStatus),
    [caseItem.caseStatus],
  );

  const assignments = useMemo(
    () => (isCaseEscalated || isCaseInReview ? caseItem.reviewAssignments : caseItem.assignments),
    [caseItem.assignments, caseItem.reviewAssignments, isCaseInReview, isCaseEscalated],
  );

  const queryClient = useQueryClient();
  const hasEditingPermission = useHasPermissions(['case-management:case-overview:write']);
  const updateCaseQueryData = useUpdateCaseQueryData();
  const handleUpdateCaseMutation = useMutation<
    unknown,
    unknown,
    Assignment[],
    { previousCaseItem: Case | undefined }
  >(
    async (assignments): Promise<void> => {
      const hideMessage = message.loading(`Saving...`);
      try {
        if (caseId == null) {
          message.fatal('Case ID is missing');
          return;
        }

        if (isCaseEscalated) {
          await api.patchCasesReviewAssignment({
            CasesReviewAssignmentsUpdateRequest: {
              caseIds: [caseId],
              reviewAssignments: assignments,
            },
          });
        } else {
          await api.patchCasesAssignment({
            CasesAssignmentsUpdateRequest: {
              caseIds: [caseId],
              assignments,
            },
          });
        }

        message.success('Saved');
      } catch (error) {
        message.fatal(`Failed to save ${getErrorMessage(error)}`, error);
      } finally {
        hideMessage();
      }
    },
    {
      onMutate: async (assignments) => {
        const previousCaseItem = queryClient.getQueryData<Case>(CASES_ITEM(caseId!));
        updateCaseQueryData(caseId, (caseItem) => {
          if (caseItem == null) {
            return caseItem;
          }
          if (isCaseEscalated) {
            return {
              ...caseItem,
              reviewAssignments: assignments,
            };
          } else {
            return {
              ...caseItem,
              assignments,
            };
          }
        });
        return { previousCaseItem };
      },
      onError: async (error, _event, context) => {
        message.fatal(`Failed to save ${getErrorMessage(error)}`, error);
        updateCaseQueryData(caseId, () => context?.previousCaseItem);
      },
    },
  );

  const handleUpdateAssignments = useCallback(
    (assignees: string[]) => {
      const newAssignments = assignees.map((assigneeUserId) => ({
        assignedByUserId: currentUserId,
        assigneeUserId,
        timestamp: Date.now(),
      }));
      handleUpdateCaseMutation.mutate(newAssignments);
    },
    [handleUpdateCaseMutation, currentUserId],
  );

  const manualCaseReason = useMemo(() => {
    const reason = caseItem?.statusChanges
      ?.sort((a, b) => a.timestamp - b.timestamp)
      ?.find(
        (statusChange) => statusChange.caseStatus === 'OPEN' && statusChange.reason?.length,
      )?.reason;

    return reason?.join(', ');
  }, [caseItem]);

  return (
    <div className={s.root}>
      <div className={s.attributes}>
        {caseItem.subjectType === 'PAYMENT'
          ? paymentSubjectLabels(caseItem)
          : userSubjectLabels(caseItem)}
        <Form.Layout.Label title={'Created at'}>
          {dayjs(caseItem.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>

        <Form.Layout.Label title={'Last updated'}>
          {dayjs(caseItem.updatedAt).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
        </Form.Layout.Label>

        <Form.Layout.Label title={'Assignees'}>
          <AssigneesDropdown
            assignments={assignments ?? []}
            editing={
              !(statusInReview(caseItem.caseStatus) || otherStatuses) && hasEditingPermission
            }
            onChange={handleUpdateAssignments}
            fixSelectorHeight
          />
        </Form.Layout.Label>

        {caseItem.caseStatus === 'CLOSED' && caseItem.lastStatusChange && (
          <Form.Layout.Label title={'Closure reason'}>
            <div>
              {caseItem?.lastStatusChange?.reason
                ? caseItem.lastStatusChange.reason.join(', ')
                : ''}
            </div>
          </Form.Layout.Label>
        )}

        {caseItem.caseType === 'MANUAL' && manualCaseReason && (
          <Form.Layout.Label title={'Open reason'}>
            <div>{manualCaseReason}</div>
          </Form.Layout.Label>
        )}

        {statusEscalated(caseItem.caseStatus) && caseItem.lastStatusChange && (
          <Form.Layout.Label title={'Escalation reason'}>
            <div>
              {caseItem?.lastStatusChange?.reason
                ? caseItem.lastStatusChange.reason.join(', ')
                : ''}
            </div>
          </Form.Layout.Label>
        )}

        {caseItem.caseHierarchyDetails?.parentCaseId && (
          <Form.Layout.Label title={'Parent case ID'}>
            <Id
              to={makeUrl(`/case-management/case/:caseId`, {
                caseId: caseItem.caseHierarchyDetails?.parentCaseId,
              })}
              alwaysShowCopy
            >
              {caseItem.caseHierarchyDetails?.parentCaseId}
            </Id>
          </Form.Layout.Label>
        )}

        {caseItem.caseHierarchyDetails?.childCaseIds && (
          <Form.Layout.Label title={'Child case ID(s)'}>
            {caseItem.caseHierarchyDetails?.childCaseIds.map((caseId) => (
              <Id
                to={makeUrl(`/case-management/case/:caseId`, {
                  caseId,
                })}
                alwaysShowCopy
              >
                {caseId}
              </Id>
            ))}
          </Form.Layout.Label>
        )}
      </div>
      <Feature name="RISK_SCORING">
        {caseUser?.userId && (
          <div className={s.risks}>
            <KycRiskDisplay userId={caseUser.userId} />
            <DynamicRiskDisplay userId={caseUser.userId} />

            <AIRiskDisplay
              businessUser={
                caseUser && 'type' in caseUser && caseUser.type === 'BUSINESS'
                  ? caseUser
                  : undefined
              }
              consumerUser={
                caseUser && 'type' in caseUser && caseUser.type === 'CONSUMER'
                  ? caseUser
                  : undefined
              }
            />
          </div>
        )}
      </Feature>
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
      label: 'SWITF account number',
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
