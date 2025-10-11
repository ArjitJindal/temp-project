import type { Currency } from '@flagright/lib/constants';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import type { QueryResult } from '@/utils/queries/types';
import {
  TRANSACTIONS_UNIQUES,
  TRANSACTIONS_LIST,
  TRANSACTIONS_ITEM,
  TRANSACTIONS_ALERTS_LIST,
  TRANSACTIONS_ITEM_RISKS_ARS,
  TRANSACTIONS_STATS,
  TRANSACTIONS_COUNT,
  TRANSACTIONS_EVENTS_FIND,
} from '@/utils/queries/keys';
import type {
  TransactionsStatsByTypesResponseData,
  TransactionsStatsByTimeResponseData,
  InternalTransactionEvent,
} from '@/apis';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import type { PaginatedData } from '@/utils/queries/hooks';
import { transactionParamsToRequest } from '@/pages/transactions/components/TransactionsTable';
import type { TransactionsUniquesField } from '@/apis/models/TransactionsUniquesField';
import type { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';

export function useTransactionsUniques(
  field: TransactionsUniquesField,
  params?: { filter?: string },
  options?: { enabled?: boolean },
): QueryResult<string[]> {
  const api = useApi();
  return useQuery(
    TRANSACTIONS_UNIQUES(field, params ?? {}),
    async () => {
      const res = await api.getTransactionsUniques({ field, ...(params ?? {}) });
      return res as string[];
    },
    options,
  );
}

export function useTransactionsList(filterId: string | undefined) {
  const api = useApi();
  return useQuery(TRANSACTIONS_LIST(filterId ?? ''), async () => {
    return api.getTransactionsList({ filterId });
  });
}

export function useTransactionsListPaginated(
  params: Record<string, any>,
  mapper?: (items: any[]) => any[],
) {
  const api = useApi();
  return usePaginatedQuery(
    TRANSACTIONS_LIST({ ...params, ...(mapper ? { mapper: mapper.toString() } : {}) }),
    async (paginationParams) => {
      const data = await api.getTransactionsList({
        ...params,
        ...paginationParams,
      });
      return {
        items: mapper ? mapper(data.items) : data.items,
        total: data.count ? parseInt(`${data.count}`) : 0,
      };
    },
  );
}

export function useTransactionsCount(params: Record<string, any>) {
  const api = useApi();
  return useQuery(TRANSACTIONS_COUNT(params), async () => {
    const countData = await api.getTransactionsList({ ...params, page: 0, pageSize: 0 });
    return { total: parseInt(`${countData.count}`) } as { total: number };
  });
}

export function useTransactionsQuery<T extends object = any>(
  params: Record<string, any>,
  mapper?: (data: any[]) => T[],
): {
  queryResult: QueryResult<PaginatedData<T>>;
  countQueryResult: QueryResult<{ total: number }>;
  cacheKey: any;
} {
  const dataParams = transactionParamsToRequest(
    {
      ...params,
      responseType: 'data',
      sort: (params as { sort?: any[] }).sort ?? [],
      pageSize: (params as { pageSize?: number }).pageSize ?? 25,
    },
    { ignoreDefaultTimestamps: true },
  );
  const queryResult = useTransactionsListPaginated(
    dataParams as Record<string, any>,
    mapper,
  ) as QueryResult<PaginatedData<T>>;
  const countParams = transactionParamsToRequest(
    {
      ...params,
      page: 0,
      pageSize: 0,
      responseType: 'count',
      sort: params.sort ?? [],
    },
    { ignoreDefaultTimestamps: true },
  );
  const countQueryResult = useTransactionsCount(countParams as Record<string, any>) as QueryResult<{
    total: number;
  }>;
  return {
    queryResult,
    countQueryResult,
    cacheKey: TRANSACTIONS_LIST(params),
  };
}

export function useTransactionItem(transactionId: string) {
  const api = useApi();
  return useQuery(TRANSACTIONS_ITEM(transactionId), () => api.getTransaction({ transactionId }));
}

export function useTransactionAlerts(
  transactionId: string,
  extra?: Partial<DefaultApiGetAlertListRequest>,
) {
  const api = useApi();
  return useQuery(TRANSACTIONS_ALERTS_LIST(transactionId), () =>
    api.getAlertList({ ...(extra ?? {}), filterTransactionIds: [transactionId] }),
  );
}

export function useTransactionArs(transactionId: string) {
  const api = useApi();
  return useQuery(TRANSACTIONS_ITEM_RISKS_ARS(transactionId), () =>
    api.getArsValue({ transactionId }),
  );
}

export function useTransactionEvents(
  transactionId: string,
  params: { page?: number; pageSize?: number },
): QueryResult<PaginatedData<InternalTransactionEvent>> {
  const api = useApi();
  return usePaginatedQuery(
    TRANSACTIONS_EVENTS_FIND(transactionId, params),
    async (paginationParams) => {
      const result = await api.getTransactionEvents({
        transactionId,
        page: paginationParams.page,
        pageSize: paginationParams.pageSize,
      });
      return result as PaginatedData<InternalTransactionEvent>;
    },
  );
}

export function useTransactionsStatsByType(params: {
  selectorParams: any;
  userId: string;
  referenceCurrency: Currency;
}): QueryResult<TransactionsStatsByTypesResponseData[]> {
  const api = useApi();
  const { selectorParams, userId, referenceCurrency } = params;
  return useQuery(
    TRANSACTIONS_STATS('by-type', { ...selectorParams, referenceCurrency, userId }),
    async () => {
      const response = await api.getTransactionsStatsByType({
        ...FIXED_API_PARAMS,
        pageSize: selectorParams.transactionsCount,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        filterTransactionState: selectorParams.selectedTransactionStates,
        referenceCurrency,
        afterTimestamp: selectorParams.timeRange?.[0]?.valueOf(),
        beforeTimestamp: selectorParams.timeRange?.[1]?.valueOf(),
      });
      return response.data;
    },
  );
}

export function useTransactionsStatsByTime(params: {
  selectorParams: any;
  userId: string;
  currency: Currency;
}): QueryResult<TransactionsStatsByTimeResponseData[]> {
  const api = useApi();
  const { selectorParams, userId, currency } = params;
  return useQuery(
    TRANSACTIONS_STATS('by-date', {
      ...selectorParams,
      userId,
      currency,
      aggregateBy: selectorParams.aggregateBy,
    }),
    async () => {
      const response = await api.getTransactionsStatsByTime({
        ...FIXED_API_PARAMS,
        pageSize: selectorParams.transactionsCount,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        filterTransactionState: selectorParams.selectedTransactionStates,
        referenceCurrency: currency,
        aggregateBy: selectorParams.aggregateBy,
        afterTimestamp: selectorParams.timeRange?.[0]?.valueOf(),
        beforeTimestamp: selectorParams.timeRange?.[1]?.valueOf(),
      });
      return response.data;
    },
  );
}
