import pluralize from 'pluralize';
import { TableUser } from './CaseTable/types';
import { QueryResult } from '@/utils/queries/types';
import { AllParams, TableData } from '@/components/library/Table/types';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { useApi } from '@/api';
import { FlagrightAuth0User, useAuth0User } from '@/utils/user-utils';
import { PaginationParams, usePaginatedQuery } from '@/utils/queries/hooks';
import { ALERT_LIST } from '@/utils/queries/keys';
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
    filterOutQaStatus,
    qaAssignment,
    updatedAt,
    filterClosingReason,
    ruleQueueIds,
    ruleNature,
    filterAlertIds,
    caseTypesFilter,
    riskLevels,
  } = params;
  const [sortField, sortOrder] = sort[0] ?? [];
  const preparedParams: DefaultApiGetAlertListRequest = {
    page,
    pageSize,
    ...paginationParams,
    filterQaStatus: filterQaStatus as ChecklistStatus[],
    filterOutQaStatus,
    filterAlertId: alertId,
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
    filterOriginPaymentMethods: originMethodFilter,
    filterDestinationPaymentMethods: destinationMethodFilter,
    filterRulesHit: rulesHitFilter,
    filterRuleQueueIds: ruleQueueIds,
    sortField: sortField === 'age' ? 'createdTimestamp' : sortField,
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
    filterClosingReason,
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

export function useAlertQuery(
  params: AllParams<TableSearchParams>,
  defaultApiParams?: DefaultApiGetAlertListRequest,
): QueryResult<TableData<TableAlertItem>> {
  const api = useApi();
  const user = useAuth0User();
  return usePaginatedQuery(
    ALERT_LIST({ ...params, ...defaultApiParams }),
    async (paginationParams) => {
      const preparedParams = getAlertsQueryParams(params, user, paginationParams, defaultApiParams);

      const result = await api.getAlertList(
        Object.entries(preparedParams).reduce(
          (acc, [key, value]) => ({ ...acc, [key]: value }),
          {},
        ),
      );
      return {
        items: presentAlertData(result.data),
        total: result.total,
        totalPages: result.totalPages,
      };
    },
  );
}

function presentAlertData(data: AlertListResponseItem[]): TableAlertItem[] {
  return data.map(({ alert, caseUsers, ...rest }) => {
    const caseUser = caseUsers ?? {};
    const user = caseUser?.origin?.userId
      ? caseUser?.origin
      : caseUser?.destination?.userId
      ? caseUser?.destination
      : undefined;
    const duration = dayjs.duration(Date.now() - alert.createdTimestamp);
    return {
      ...alert,
      caseCreatedTimestamp: rest.caseCreatedTimestamp,
      caseUserName: getUserName(user as TableUser | undefined),
      age: pluralize('day', Math.floor(duration.asDays()), true),
      caseUserId: caseUsers?.origin?.userId ?? caseUsers?.destination?.userId ?? '',
      caseType: rest.caseType,
      user: user as TableUser | undefined,
      lastStatusChangeReasons: {
        reasons: alert.lastStatusChange?.reason ?? [],
        otherReason: alert.lastStatusChange?.otherReason ?? null,
      },
    };
  });
}
