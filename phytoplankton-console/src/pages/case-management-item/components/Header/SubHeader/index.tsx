import { useCallback, useMemo } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import { message } from '@/components/library/Message';
import { Assignment, Case } from '@/apis';
import { useApi } from '@/api';
import * as Form from '@/components/ui/Form';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import {
  Feature,
  useFeatureEnabled,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import KycRiskDisplay from '@/pages/users-item/UserDetails/KycRiskDisplay';
import DynamicRiskDisplay from '@/pages/users-item/UserDetails/DynamicRiskDisplay';
import { CASES_ITEM } from '@/utils/queries/keys';
import { getErrorMessage, neverReturn } from '@/utils/lang';
import { useUpdateCaseQueryData } from '@/utils/api/cases';
import {
  canAssignToUser,
  createAssignments,
  getAssignmentsToShow,
  statusEscalated,
  statusInReview,
} from '@/utils/case-utils';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { getUserLink, getUserName } from '@/utils/api/users';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { getPaymentMethodTitle } from '@/utils/payments';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { UserTrsRiskDisplay } from '@/pages/users-item/UserDetails/UserTrsRiskDisplay';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';

interface Props {
  caseId: string;
  caseItemRes: AsyncResource<Case>;
}

export default function SubHeader(props: Props) {
  const settings = useSettings();
  const { caseId, caseItemRes } = props;
  const caseItem = getOr(caseItemRes, undefined);
  const caseUsers = caseItem?.caseUsers;
  const subjectType = caseItem?.caseUsers ?? 'USER';

  const api = useApi();
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const isUserSubject = subjectType === 'USER';
  let caseUser;
  if (isUserSubject && caseUsers) {
    caseUser = caseUsers?.origin ?? caseUsers?.destination;
  }
  const isCaseInReview = statusInReview(caseItem?.caseStatus);
  const isCaseEscalated = statusEscalated(caseItem?.caseStatus);

  const isMultiLevelEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

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

        if (isCaseInReview || isCaseEscalated) {
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
        const previousCaseItem = caseId
          ? queryClient.getQueryData<Case>(CASES_ITEM(caseId))
          : undefined;
        updateCaseQueryData(caseId, (caseItem) => {
          if (caseItem == null) {
            return caseItem;
          }
          if (isCaseEscalated) {
            return {
              ...caseItem,
              reviewAssignments: assignments,
              updatedAt: Date.now(),
            };
          } else {
            return {
              ...caseItem,
              assignments,
              updatedAt: Date.now(),
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
      const caseStatus = caseItem?.caseStatus ?? 'OPEN';
      const [assignments, _] = createAssignments(
        caseStatus,
        assignees,
        isMultiLevelEscalationEnabled,
        currentUserId ?? '',
      );
      if (caseId == null) {
        message.fatal('Case ID is null');
        return;
      }
      handleUpdateCaseMutation.mutate(assignments);
    },
    [handleUpdateCaseMutation, currentUserId, caseItem, isMultiLevelEscalationEnabled, caseId],
  );

  const manualCaseReason = useMemo(() => {
    const reason = caseItem?.statusChanges
      ?.sort((a, b) => a.timestamp - b.timestamp)
      ?.find(
        (statusChange) => statusChange.caseStatus === 'OPEN' && statusChange.reason?.length,
      )?.reason;

    return reason?.join(', ');
  }, [caseItem?.statusChanges]);

  return (
    <div className={s.root}>
      <div className={s.attributes}>
        {caseItem &&
          (caseItem.subjectType === 'PAYMENT'
            ? paymentSubjectLabels(caseItem)
            : userSubjectLabels(caseItem, firstLetterUpper(settings.userAlias)))}
        <Form.Layout.Label title={'Created at'}>
          <Skeleton res={caseItemRes}>
            {(caseItem) =>
              dayjs(caseItem.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)
            }
          </Skeleton>
        </Form.Layout.Label>

        <Form.Layout.Label title={'Last updated'}>
          <Skeleton res={caseItemRes}>
            {(caseItem) => dayjs(caseItem.updatedAt).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
          </Skeleton>
        </Form.Layout.Label>

        <Form.Layout.Label title={'Assigned to'}>
          <Skeleton res={caseItemRes}>
            {(caseItem) => (
              <AssigneesDropdown
                assignments={getAssignmentsToShow(caseItem) ?? []}
                editing={!(caseItem?.caseStatus === 'CLOSED') && hasEditingPermission}
                customFilter={(account) =>
                  canAssignToUser(
                    caseItem?.caseStatus ?? 'OPEN',
                    account,
                    isMultiLevelEscalationEnabled,
                  )
                }
                onChange={handleUpdateAssignments}
                fixSelectorHeight
              />
            )}
          </Skeleton>
        </Form.Layout.Label>

        {caseItem?.caseStatus === 'CLOSED' && caseItem?.lastStatusChange && (
          <Form.Layout.Label title={'Closure reason'}>
            <div>
              {caseItem?.lastStatusChange?.reason
                ? caseItem.lastStatusChange.reason.join(', ')
                : ''}
            </div>
          </Form.Layout.Label>
        )}

        {caseItem?.caseType === 'MANUAL' && manualCaseReason && (
          <Form.Layout.Label title={'Open reason'}>
            <div>{manualCaseReason}</div>
          </Form.Layout.Label>
        )}

        {statusEscalated(caseItem?.caseStatus) && caseItem?.lastStatusChange && (
          <Form.Layout.Label title={'Escalation reason'}>
            <div>
              {caseItem?.lastStatusChange?.reason
                ? caseItem.lastStatusChange.reason.join(', ')
                : ''}
            </div>
          </Form.Layout.Label>
        )}

        {caseItem?.caseHierarchyDetails?.parentCaseId && (
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

        {caseItem?.caseHierarchyDetails?.childCaseIds && (
          <Form.Layout.Label title={'Child case ID(s)'}>
            {caseItem.caseHierarchyDetails?.childCaseIds.map((caseId, index) => (
              <Id
                to={makeUrl(`/case-management/case/:caseId`, {
                  caseId,
                })}
                alwaysShowCopy
                key={index}
              >
                {caseId}
              </Id>
            ))}
          </Form.Layout.Label>
        )}
        {caseItem?.caseType === 'EXTERNAL' && caseItem?.creationReason && (
          <Form.Layout.Label title={'Creation reason'}>
            {caseItem.creationReason?.reasons.join(', ')}
          </Form.Layout.Label>
        )}
      </div>
      <Feature name="RISK_SCORING">
        {caseUser?.userId && (
          <div className={s.risks}>
            <KycRiskDisplay userId={caseUser.userId} />
            <UserTrsRiskDisplay userId={caseUser.userId} />
            <DynamicRiskDisplay userId={caseUser.userId} />
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
