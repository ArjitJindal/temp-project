import { useQueryClient } from '@tanstack/react-query';
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
} from '@/utils/queries/keys';
import { parseQuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import type { QueryOptions, QueryResult } from '@/utils/queries/types';
import type { PaginatedData, CursorPaginatedData } from '@/utils/queries/hooks';
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
} from '@/apis';
// duplicate import removed
import type { DefaultApiPatchAlertsQaAssignmentsRequest } from '@/apis/types/ObjectParamAPI';
import { dayjs } from '@/utils/dayjs';

export function useAlert(
  alertId: string,
  options?: QueryOptions<Alert, Alert>,
): QueryResult<Alert> {
  const api = useApi();
  return useQuery<Alert>(
    ALERT_ITEM(alertId),
    async () => {
      try {
        return await api.getAlert({ alertId });
      } catch (error: any) {
        if (error?.code === 404) {
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
  return useQuery<T>(ALERT_ITEM(alertId ?? ''), async () => {
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
  return useQuery<string[]>(COPILOT_SUGGESTIONS(question, alertId), async () => {
    const response = await api.getQuestionAutocomplete({ question, alertId });
    return response.suggestions ?? [];
  });
}

export function useAlertList(
  params: { action?: RuleAction; transactionId?: string } & Record<string, unknown>,
  transaction?: InternalTransaction,
): QueryResult<PaginatedData<Alert>> {
  const api = useApi();
  return usePaginatedQuery<Alert>(ALERT_LIST({ ...params }), async ({ page }) => {
    const response = await api.getAlertList({
      ...(params as any),
      page: page ?? (params as any).page,
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
  return useCursorQuery<TransactionTableItem>(
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
  return useQuery<{ value: string; label: string }[]>(
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

export function usePatchAlertQaAssignments(options?: Parameters<typeof useMutation>[1]) {
  const api = useApi();
  return useMutation(
    (vars: DefaultApiPatchAlertsQaAssignmentsRequest) => api.patchAlertsQaAssignments(vars),
    options as any,
  );
}

export function useCreateQaSample(options?: Parameters<typeof useMutation>[1]) {
  const api = useApi();
  return useMutation<AlertsQaSampling, unknown, AlertsQaSamplingRequest>(
    async (data) => await api.createAlertsQaSampling({ AlertsQaSamplingRequest: data }),
    options as any,
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
    options as any,
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
