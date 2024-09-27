import { TableSearchParams } from './types';
import CaseTable from './CaseTable';
import { dayjs } from '@/utils/dayjs';
import { Case } from '@/apis';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { AllParams } from '@/components/library/Table/types';
import { CASES_LIST } from '@/utils/queries/keys';
import { useRuleOptions } from '@/utils/rules';
import { useAuth0User } from '@/utils/user-utils';
import { getStatuses } from '@/utils/case-utils';

export default function CaseTableWrapper(props: {
  params: TableSearchParams;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
}) {
  const { params, onChangeParams } = props;
  const api = useApi();
  const auth0user = useAuth0User();
  const queryResults = usePaginatedQuery<Case>(CASES_LIST(params), async (paginationParams) => {
    const {
      sort,
      page,
      pageSize,
      createdTimestamp,
      caseId,
      rulesHitFilter,
      rulesExecutedFilter,
      userId,
      userFilterMode,
      originMethodFilter,
      destinationMethodFilter,
      tagKey,
      tagValue,
      caseStatus,
      businessIndustryFilter,
      riskLevels,
      userStates,
      showCases,
      assignedTo,
      roleAssignedTo,
      updatedAt,
      caseTypesFilter,
      ruleQueueIds,
      alertPriority,
      ruleNature,
    } = params;

    const [sortField, sortOrder] = sort[0] ?? [];

    const response = await api.getCaseList({
      page,
      pageSize,
      ...paginationParams,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp
        ? dayjs(createdTimestamp[1]).valueOf()
        : Number.MAX_SAFE_INTEGER,
      filterId: caseId,
      filterRulesHit: rulesHitFilter,
      filterRulesExecuted: rulesExecutedFilter,
      filterCaseStatus: getStatuses(caseStatus),
      filterUserId: userFilterMode === 'ALL' ? userId : undefined,
      filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
      filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
      sortField: sortField ?? undefined,
      sortOrder: sortOrder ?? undefined,
      filterOriginPaymentMethods: originMethodFilter,
      filterDestinationPaymentMethods: destinationMethodFilter,
      filterTransactionTagKey: tagKey,
      filterTransactionTagValue: tagValue,
      filterBusinessIndustries: businessIndustryFilter,
      filterRiskLevel: riskLevels,
      filterCaseTypes: caseTypesFilter,
      filterUserState: userStates,
      filterRuleQueueIds: ruleQueueIds,
      filterRuleNature: ruleNature,
      filterAssignmentsIds:
        showCases === 'MY' ? [auth0user.userId] : assignedTo?.length ? assignedTo : undefined,
      filterAssignmentsRoles:
        showCases === 'MY'
          ? auth0user.role
            ? [auth0user.role]
            : []
          : roleAssignedTo?.length
          ? roleAssignedTo
          : undefined,
      ...(updatedAt && {
        filterCasesByLastUpdatedStartTimestamp: updatedAt ? dayjs(updatedAt[0]).valueOf() : 0,
        filterCasesByLastUpdatedEndTimestamp: updatedAt
          ? dayjs(updatedAt[1]).valueOf()
          : Number.MAX_SAFE_INTEGER,
      }),
      filterAlertPriority: alertPriority,
    });

    return {
      total: response.total,
      items: response.data,
    };
  });
  const ruleOptions = useRuleOptions();

  return (
    <CaseTable
      params={params}
      onChangeParams={onChangeParams}
      queryResult={queryResults}
      rules={ruleOptions}
      showAssignedToFilter={params.showCases === 'MY' ? false : true}
    />
  );
}
