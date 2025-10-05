import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { CASES_ITEM, CASES_LIST, CASES_USERS_CASEIDS } from '@/utils/queries/keys';
import { Case } from '@/apis';
import type { QueryOptions, PaginatedQueryOptions, QueryResult } from '@/utils/queries/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import { DefaultApiGetCaseListRequest } from '@/apis/types/ObjectParamAPI';
import { dayjs } from '@/utils/dayjs';
import { getStatuses } from '@/utils/case-utils';
import { useAuth0User } from '@/utils/user-utils';

export function useCase(caseId: string, options?: QueryOptions<Case, Case>): QueryResult<Case> {
  const api = useApi();
  return useQuery<Case>(CASES_ITEM(caseId), (): Promise<Case> => api.getCase({ caseId }), options);
}

export function useCasesList(filter: DefaultApiGetCaseListRequest): QueryResult<any> {
  const api = useApi();
  return useQuery(CASES_LIST(filter), async () => api.getCaseList(filter));
}

export function useCasesListPaginated(
  params: any,
  options?: PaginatedQueryOptions<Case>,
): QueryResult<PaginatedData<Case>> {
  const api = useApi();
  const auth0user = useAuth0User();
  return usePaginatedQuery<Case>(
    CASES_LIST(params),
    async (paginationParams) => {
      const {
        sort,
        page,
        pageSize,
        view,
        createdTimestamp,
        caseId,
        rulesHitFilter,
        rulesExecutedFilter,
        userId,
        parentUserId,
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
        filterCaseSlaPolicyId,
        filterCaseSlaPolicyStatus,
        filterClosingReason,
      } = params;

      const [sortField, sortOrder] = sort?.[0] ?? [];

      const afterTimestamp =
        createdTimestamp?.[0] != null ? dayjs(createdTimestamp[0]).valueOf() : 0;
      const beforeTimestamp =
        createdTimestamp?.[1] != null
          ? dayjs(createdTimestamp[1]).valueOf()
          : Number.MAX_SAFE_INTEGER;

      const response = await api.getCaseList({
        page,
        pageSize,
        view,
        ...paginationParams,
        afterTimestamp,
        beforeTimestamp,
        filterId: caseId,
        filterRulesHit: rulesHitFilter,
        filterRulesExecuted: rulesExecutedFilter,
        filterCaseStatus: getStatuses(caseStatus),
        filterUserId: userId,
        filterParentUserId: parentUserId,
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
        filterAssignmentsRoles: roleAssignedTo?.length ? roleAssignedTo : undefined,
        ...(updatedAt && {
          filterCasesByLastUpdatedStartTimestamp: updatedAt ? dayjs(updatedAt[0]).valueOf() : 0,
          filterCasesByLastUpdatedEndTimestamp: updatedAt
            ? dayjs(updatedAt[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
        }),
        filterAlertPriority: alertPriority,
        filterCaseSlaPolicyId: filterCaseSlaPolicyId?.length ? filterCaseSlaPolicyId : undefined,
        filterCaseSlaPolicyStatus: filterCaseSlaPolicyStatus?.length
          ? filterCaseSlaPolicyStatus
          : undefined,
        filterCaseClosureReasons: filterClosingReason?.length ? filterClosingReason : undefined,
      });

      return {
        total: response.total,
        items: response.data,
      };
    },
    options,
  );
}

export function useCasesAssignmentUpdate() {
  const api = useApi();
  return useMutation((vars: { caseIds: string[]; assignments: any[] }) =>
    api.patchCasesAssignment({
      CasesAssignmentsUpdateRequest: { caseIds: vars.caseIds, assignments: vars.assignments },
    }),
  );
}

export function useCasesReviewAssignmentUpdate() {
  const api = useApi();
  return useMutation((vars: { caseIds: string[]; reviewAssignments: any[] }) =>
    api.patchCasesReviewAssignment({
      CasesReviewAssignmentsUpdateRequest: {
        caseIds: vars.caseIds,
        reviewAssignments: vars.reviewAssignments,
      },
    }),
  );
}

export function useCaseIds(params: { userId: string; caseType: 'MANUAL' | 'AUTO' }) {
  const api = useApi();
  return useQuery(CASES_USERS_CASEIDS(params), async () =>
    api.getCaseIds({ userId: params.userId, filterCaseTypes: params.caseType }),
  );
}
