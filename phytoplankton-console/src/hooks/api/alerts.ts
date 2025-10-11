import { useQueryClient } from '@tanstack/react-query';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { usePaginatedQuery, useCursorQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  ALERT_ITEM,
  ALERT_LIST,
  COPILOT_ALERT_QUESTIONS,
  COPILOT_SUGGESTIONS,
  ALERT_ITEM_TRANSACTION_LIST,
  AIF_SEARCH_KEY,
  ALERT_QA_SAMPLE,
  QA_SAMPLE_IDS,
  ALERT_COMMENTS,
  ALERT_ITEM_COMMENTS,
  ALERT_QA_SAMPLING,
} from '@/utils/queries/keys';
import { parseQuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import type { QueryOptions, QueryResult } from '@/utils/queries/types';
import type { AllParams, TableData } from '@/components/library/Table/types';
import type { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import type { PaginatedData, CursorPaginatedData, PaginationParams } from '@/utils/queries/hooks';
import { NotFoundError } from '@/utils/errors';
import {
  Alert,
  InternalTransaction,
  RuleAction,
  TransactionTableItem,
  CurrencyCode,
  AlertsQaSampling,
  AlertsQaSamplingRequest,
  AlertsQaSamplingUpdateRequest,
  AlertListResponseItem,
  ChecklistStatus,
} from '@/apis';
import type {
  DefaultApiGetAlertListRequest,
  DefaultApiPatchAlertsQaAssignmentsRequest,
} from '@/apis/types/ObjectParamAPI';
import { getStatuses } from '@/utils/case-utils';
import { getUserName } from '@/utils/api/users';
import type { TableUser } from '@/pages/case-management/CaseTable/types';
import { useAuth0User } from '@/utils/user-utils';
import type { TableSearchParams } from '@/pages/case-management/types';

export function useAlert(
  alertId: string,
  options?: QueryOptions<Alert, Alert>,
): QueryResult<Alert> {
  const api = useApi();
  return useQuery(
    ALERT_ITEM(alertId),
    async () => {
      try {
        return await api.getAlert({ alertId });
      } catch (error) {
        const err = error as { code?: number };
        if (err?.code === 404) {
          throw new NotFoundError(`Alert with ID "${alertId}" not found`);
        }
        throw error;
      }
    },
    options,
  );
}

// For cases where we already have alert data but want it cached under ALERT_ITEM key
export function useAlertPrimed<T>(alertId: string | undefined, alertData: T) {
  return useQuery(ALERT_ITEM(alertId ?? ''), async () => {
    return alertData;
  });
}

export function useCopilotQuestions(
  alertId: string,
): QueryResult<ReturnType<typeof parseQuestionResponse>> {
  const api = useApi();
  return useQuery(COPILOT_ALERT_QUESTIONS(alertId), async () =>
    parseQuestionResponse(await api.getQuestions({ alertId })),
  );
}

export function useCopilotSuggestions(question: string, alertId: string): QueryResult<string[]> {
  const api = useApi();
  return useQuery(COPILOT_SUGGESTIONS(question, alertId), async () => {
    const response = await api.getQuestionAutocomplete({ question, alertId });
    return response.suggestions ?? [];
  });
}

export function useAlertList(
  params: { action?: RuleAction; transactionId?: string } & Record<string, any>,
  transaction?: InternalTransaction,
): QueryResult<PaginatedData<Alert>> {
  const api = useApi();
  return usePaginatedQuery(ALERT_LIST({ ...params }), async ({ page }) => {
    const response = await api.getAlertList({
      ...params,
      page: page ?? (params as { page?: number }).page,
      filterRuleInstanceId: params.action
        ? (transaction?.hitRules || [])
            .filter((rule) => rule.ruleInstanceId && rule.ruleAction === params.action)
            .map((rule) => rule.ruleInstanceId)
        : undefined,
      filterTransactionIds: params.transactionId ? [params.transactionId] : undefined,
    });
    return {
      items: response.data.map(({ alert }) => alert),
      total: response.total,
    };
  });
}

export function useAlertTransactionList(
  alertId: string | undefined,
  params: any,
  options?: { fixedParams?: Record<string, any>; enabled?: boolean },
): QueryResult<CursorPaginatedData<TransactionTableItem>> {
  const api = useApi();
  return useCursorQuery(
    ALERT_ITEM_TRANSACTION_LIST(alertId ?? '', params),
    async ({ from, view }) => {
      if (alertId == null) {
        throw new Error(`Unable to fetch transactions for alert, it's id is empty`);
      }
      const [sortField, sortOrder] = params.sort?.[0] ?? [];
      return await api.getAlertTransactionList({
        ...(options?.fixedParams ?? {}),
        ...params,
        alertId,
        start: from ?? params.from,
        page: params.page,
        pageSize: params.pageSize,
        view,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
        filterOriginPaymentMethods: params.originMethodFilter,
        filterDestinationPaymentMethods: params.destinationMethodFilter,
        filterTransactionId: params.transactionId,
        filterOriginCurrencies: params.originCurrenciesFilter as CurrencyCode[],
        filterDestinationCurrencies: params.destinationCurrenciesFilter as CurrencyCode[],
        beforeTimestamp: params.timestamp ? dayjs(params.timestamp[1]).valueOf() : undefined,
        afterTimestamp: params.timestamp ? dayjs(params.timestamp[0]).valueOf() : undefined,
        filterDestinationCountries: params['destinationAmountDetails.country'],
        filterOriginCountries: params['originAmountDetails.country'],
        filterSanctionsHitId: params.filterSanctionsHitId,
        filterPaymentDetailName: params.filterPaymentDetailName,
        filterPaymentMethodId: params.filterPaymentMethodId,
        filterReference: params.reference,
      });
    },
    { enabled: options?.enabled ?? true },
  );
}

export function useCreateAlertComment() {
  const api = useApi();
  return async (request: { alertId: string; CommentRequest: { body: string; files?: any[] } }) => {
    return await api.createAlertsComment(request);
  };
}

export function useAlertsAssignmentUpdate() {
  const api = useApi();
  return useMutation((vars: { alertIds: string[]; assignments: any[] }) =>
    api.alertsAssignment({
      AlertsAssignmentsUpdateRequest: {
        alertIds: vars.alertIds,
        assignments: vars.assignments,
      },
    }),
  );
}

export function useAlertsReviewAssignmentUpdate() {
  const api = useApi();
  return useMutation((vars: { alertIds: string[]; reviewAssignments: any[] }) =>
    api.alertsReviewAssignment({
      AlertsReviewAssignmentsUpdateRequest: {
        alertIds: vars.alertIds,
        reviewAssignments: vars.reviewAssignments,
      },
    }),
  );
}

export function useQuestionVariableAutocomplete(
  questionId: string,
  variableKey: string,
  search: string,
  options?: { enabled?: boolean },
): QueryResult<{ value: string; label: string }[]> {
  const api = useApi();
  return useQuery(
    AIF_SEARCH_KEY(questionId, variableKey, search),
    async () => {
      const results = await api.getQuestionVariableAutocomplete({
        questionId,
        variableKey,
        search,
      });
      return (results.suggestions ?? []).map((s: string) => ({ value: s, label: s }));
    },
    options,
  );
}

export function usePostQuestion() {
  const api = useApi();
  return async (request: {
    alertId: string;
    QuestionRequest: { question: string; variables: any[] };
  }) => {
    return await api.postQuestion(request);
  };
}

export function useQaSample(sampleId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(
    ALERT_QA_SAMPLE(sampleId),
    async () => await api.getAlertsQaSample({ sampleId }),
    {
      enabled: options?.enabled ?? true,
    },
  );
}

export function useQaSampleIds() {
  const api = useApi();
  return useQuery(QA_SAMPLE_IDS(), async () => await api.getAlertsQaSampleIds());
}

export function useQaSamples(params: any) {
  const api = useApi();
  return usePaginatedQuery(ALERT_QA_SAMPLING({ ...params }), async (paginationParams) => {
    const data = await api.getAlertsQaSampling({
      ...paginationParams,
      sortField: params.sort?.[0]?.[0],
      sortOrder: params.sort?.[0]?.[1] ?? 'descend',
      filterSampleName: params.samplingName,
      filterSampleId: params.samplingId,
      filterPriority: params.priority,
      filterCreatedById: params.createdBy,
      filterCreatedBeforeTimestamp: params.createdAt?.[1],
      filterCreatedAfterTimestamp: params.createdAt?.[0],
    });

    return {
      items: data.data,
      total: data.total,
    };
  });
}

// Params builder for alert list API
export const getAlertsQueryParams = (
  params: AllParams<TableSearchParams>,
  user: { userId: string },
  paginationParams?: Partial<PaginationParams>,
  defaultApiParams?: DefaultApiGetAlertListRequest,
): DefaultApiGetAlertListRequest => {
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
    alertPriority,
    filterAlertSlaPolicyId,
    filterAlertSlaPolicyStatus,
  } = params;
  const [sortField, sortOrder] = (sort?.[0] as [string | undefined, string | undefined]) ?? [];
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
    sortOrder: (sortOrder as 'ascend' | 'descend' | undefined) ?? undefined,
    filterAlertsByLastUpdatedStartTimestamp:
      updatedAt && updatedAt[0] ? dayjs(updatedAt[0]).valueOf() : undefined,
    filterAlertsByLastUpdatedEndTimestamp:
      updatedAt && updatedAt[1] ? dayjs(updatedAt[1]).valueOf() : undefined,
    ...(createdTimestamp
      ? {
          filterAlertBeforeCreatedTimestamp: createdTimestamp
            ? dayjs(createdTimestamp[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
          filterAlertAfterCreatedTimestamp: createdTimestamp
            ? dayjs(createdTimestamp[0]).valueOf()
            : 0,
        }
      : {}),
    ...(caseCreatedTimestamp
      ? {
          filterCaseBeforeCreatedTimestamp: caseCreatedTimestamp
            ? dayjs(caseCreatedTimestamp[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
          filterCaseAfterCreatedTimestamp: caseCreatedTimestamp
            ? dayjs(caseCreatedTimestamp[0]).valueOf()
            : 0,
        }
      : {}),
    filterClosingReason: filterClosingReason?.length ? filterClosingReason : undefined,
    filterAlertPriority: alertPriority,
    filterRuleNature: ruleNature,
    filterCaseTypes: caseTypesFilter,
    filterRiskLevel: riskLevels,
    filterAlertSlaPolicyId: filterAlertSlaPolicyId,
    filterAlertSlaPolicyStatus: filterAlertSlaPolicyStatus,
    ...defaultApiParams,
  };
  return preparedParams;
};

interface AlertRestData {
  age?: number;
  caseCreatedTimestamp?: number;
  caseType?: string;
}

function presentAlertData(data: AlertListResponseItem[]): TableAlertItem[] {
  return data.map(({ alert, caseUsers, ...rest }) => {
    const caseUser = caseUsers ?? {};
    const user = caseUser?.origin?.userId
      ? caseUser?.origin
      : caseUser?.destination?.userId
      ? caseUser?.destination
      : undefined;
    const restData = rest as AlertRestData;
    const alertData = {
      ...alert,
      age: restData.age,
      caseCreatedTimestamp: restData.caseCreatedTimestamp,
      caseUserName: getUserName(user as TableUser | undefined),
      caseUserId: caseUsers?.origin?.userId ?? caseUsers?.destination?.userId ?? '',
      caseType: restData.caseType,
      user: user as TableUser | undefined,
      lastStatusChangeReasons: {
        reasons: alert.lastStatusChange?.reason ?? [],
        otherReason: alert.lastStatusChange?.otherReason ?? null,
      } as { reasons: string[]; otherReason: string | null },
      proposedAction: alert.lastStatusChange?.caseStatus,
    } as TableAlertItem;
    if ((alertData.lastStatusChangeReasons?.reasons?.length ?? 0) === 0) {
      const inReviewChange = alert.statusChanges?.find((change) =>
        (change.caseStatus as string | undefined)?.startsWith('IN_REVIEW'),
      );
      alertData.lastStatusChangeReasons = {
        reasons: inReviewChange?.reason ?? [],
        otherReason: inReviewChange?.otherReason ?? null,
      };
    }
    return alertData;
  });
}

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
    { meta: { atf: true } },
  );
}

export function usePatchAlertQaAssignments(options?: Parameters<typeof useMutation>[1]) {
  const api = useApi();
  return useMutation(
    (vars: DefaultApiPatchAlertsQaAssignmentsRequest) => api.patchAlertsQaAssignments(vars),
    options,
  );
}

export function useCreateQaSample(options?: Parameters<typeof useMutation>[1]) {
  const api = useApi();
  return useMutation<AlertsQaSampling, unknown, AlertsQaSamplingRequest>(
    async (data) => await api.createAlertsQaSampling({ AlertsQaSamplingRequest: data }),
    options,
  );
}

export function useUpdateQaSample(options?: Parameters<typeof useMutation>[1]) {
  const api = useApi();
  return useMutation<
    AlertsQaSampling,
    unknown,
    { sampleId: string; body: AlertsQaSamplingUpdateRequest }
  >(
    async ({ sampleId, body }) =>
      await api.patchAlertsQaSample({ sampleId, AlertsQaSamplingUpdateRequest: body }),
    options,
  );
}

export type CommentGroup = { title: string; id: string; comments: any[] };

export function useAlertsComments(alertIds: string[], options?: { enabled?: boolean }) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useQuery<CommentGroup[]>(
    ALERT_COMMENTS(alertIds),
    async () => {
      const result = await api.getComments({
        filterEntityIds: alertIds,
        filterEntityTypes: ['ALERT'],
      });
      for (const item of result.items ?? []) {
        if (item.entityId) {
          queryClient.setQueryData(ALERT_ITEM_COMMENTS(item.entityId), item.comments ?? []);
        }
      }
      return (alertIds ?? []).map((alertId) => ({
        title: 'Alert comments',
        id: alertId,
        comments: (result.items ?? []).find((i) => i.entityId === alertId)?.comments ?? [],
      }));
    },
    { enabled: options?.enabled ?? alertIds.length > 0 },
  );
}
