import { TableUser } from './CaseTable/types';
import { AllParams } from '@/components/library/Table/types';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { FlagrightAuth0User } from '@/utils/user-utils';
import { PaginationParams } from '@/utils/queries/hooks';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';
import { getStatuses } from '@/utils/case-utils';
import { AlertListResponseItem, ChecklistStatus } from '@/apis';
import dayjs from '@/utils/dayjs';
import { getUserName } from '@/utils/api/users';
import { TableSearchParams } from '@/pages/case-management/types';

export const getAlertsQueryParams = (
  params: AllParams<TableSearchParams>,
  user: FlagrightAuth0User,
  paginationParams?: Partial<PaginationParams>,
  defaultApiParams?: DefaultApiGetAlertListRequest,
) => {
  const {
    sort,
    page,
    pageSize,
    alertId,
    alertStatus,
    userId,
    parentUserId,
    businessIndustryFilter,
    tagKey,
    tagValue,
    caseId,
    assignedTo,
    roleAssignedTo,
    showCases,
    destinationMethodFilter,
    originMethodFilter,
    createdTimestamp,
    caseCreatedTimestamp,
    rulesHitFilter,
    filterQaStatus,
    qaAssignment,
    updatedAt,
    filterClosingReason,
    ruleQueueIds,
    ruleNature,
    filterAlertIds,
    sampleId,
    caseTypesFilter,
    riskLevels,
  } = params;
  const [sortField, sortOrder] = sort[0] ?? [];
  const preparedParams: DefaultApiGetAlertListRequest = {
    page,
    pageSize,
    ...paginationParams,
    filterQaStatus: filterQaStatus as ChecklistStatus | undefined,
    filterAlertId: alertId,
    sampleId: sampleId,
    filterAlertIds,
    filterCaseId: caseId,
    filterAlertStatus: getStatuses(alertStatus),
    filterAssignmentsIds:
      showCases === 'MY_ALERTS' ? [user.userId] : assignedTo?.length ? assignedTo : undefined,
    filterAssignmentsRoles: roleAssignedTo?.length ? roleAssignedTo : undefined,
    filterQaAssignmentsIds: qaAssignment?.length ? qaAssignment : undefined,
    filterBusinessIndustries:
      businessIndustryFilter && businessIndustryFilter.length > 0
        ? businessIndustryFilter
        : undefined,
    filterTransactionTagKey: tagKey,
    filterTransactionTagValue: tagValue,
    filterUserId: userId,
    filterParentUserId: parentUserId,
    filterOriginPaymentMethods: originMethodFilter,
    filterDestinationPaymentMethods: destinationMethodFilter,
    filterRulesHit: rulesHitFilter,
    filterRuleQueueIds: ruleQueueIds,
    sortField: sortField,
    sortOrder: sortOrder ?? undefined,
    filterAlertsByLastUpdatedStartTimestamp:
      updatedAt && updatedAt[0] ? dayjs.dayjs(updatedAt[0]).valueOf() : undefined,
    filterAlertsByLastUpdatedEndTimestamp:
      updatedAt && updatedAt[1] ? dayjs.dayjs(updatedAt[1]).valueOf() : undefined,
    ...(createdTimestamp
      ? {
          filterAlertBeforeCreatedTimestamp: createdTimestamp
            ? dayjs.dayjs(createdTimestamp[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
          filterAlertAfterCreatedTimestamp: createdTimestamp
            ? dayjs.dayjs(createdTimestamp[0]).valueOf()
            : 0,
        }
      : {}),
    ...(caseCreatedTimestamp
      ? {
          filterCaseBeforeCreatedTimestamp: caseCreatedTimestamp
            ? dayjs.dayjs(caseCreatedTimestamp[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
          filterCaseAfterCreatedTimestamp: caseCreatedTimestamp
            ? dayjs.dayjs(caseCreatedTimestamp[0]).valueOf()
            : 0,
        }
      : {}),
    filterClosingReason: filterClosingReason?.length ? filterClosingReason : undefined,
    filterAlertPriority: params.alertPriority,
    filterRuleNature: ruleNature,
    filterCaseTypes: caseTypesFilter,
    filterRiskLevel: riskLevels,
    filterAlertSlaPolicyId: params.filterAlertSlaPolicyId,
    filterAlertSlaPolicyStatus: params.filterAlertSlaPolicyStatus,
    ...defaultApiParams,
  };
  return preparedParams;
};

export function presentAlertData(data: AlertListResponseItem[]): TableAlertItem[] {
  return data.map(({ alert, caseUsers, ...rest }) => {
    const caseUser = caseUsers ?? {};
    const user = caseUser?.origin?.userId
      ? caseUser?.origin
      : caseUser?.destination?.userId
      ? caseUser?.destination
      : undefined;
    const alertData = {
      ...alert,
      age: rest.age,
      caseCreatedTimestamp: rest.caseCreatedTimestamp,
      caseUserName: getUserName(user as TableUser | undefined),
      caseUserId: caseUsers?.origin?.userId ?? caseUsers?.destination?.userId ?? '',
      caseType: rest.caseType,
      user: user as TableUser | undefined,
      lastStatusChangeReasons: {
        reasons: alert.lastStatusChange?.reason ?? [],
        otherReason: alert.lastStatusChange?.otherReason ?? null,
      },
      proposedAction: alert.lastStatusChange?.caseStatus,
    };
    if (alertData.lastStatusChangeReasons.reasons.length === 0) {
      const inReviewChange = alert.statusChanges?.find((change) =>
        change.caseStatus?.startsWith('IN_REVIEW'),
      );

      alertData.lastStatusChangeReasons.reasons = inReviewChange?.reason ?? [];
      alertData.lastStatusChangeReasons.otherReason = inReviewChange?.otherReason ?? null;
    }
    return alertData;
  });
}
