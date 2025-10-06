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

export function useTransactionsUniques(
  field: any,
  params?: { filter?: string },
  options?: { enabled?: boolean },
): QueryResult<string[]> {
  const api = useApi();
  return useQuery<string[]>(
    TRANSACTIONS_UNIQUES(field, params ?? {}),
    async () => {
      const res = await api.getTransactionsUniques({ field, ...(params ?? {}) });
      return res as any[] as string[];
    },
    options,
  );
}

export function useTransactionsList(filterId: string | undefined): QueryResult<any> {
  const api = useApi();
  return useQuery(TRANSACTIONS_LIST(filterId ?? ''), async () => {
    return api.getTransactionsList({ filterId });
  });
}

export function useTransactionsListPaginated(params: any, mapper?: (items: any[]) => any[]) {
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

export function useTransactionsCount(params: any) {
  const api = useApi();
  return useQuery(TRANSACTIONS_COUNT(params), async () => {
    const countData = await api.getTransactionsList({ ...params, page: 0, pageSize: 0 });
    return { total: parseInt(`${countData.count}`) } as { total: number };
  });
}

export function useTransactionsQuery<T extends object = any>(
  params: any,
  mapper?: (data: any[]) => T[],
): {
  queryResult: QueryResult<PaginatedData<T>>;
  countQueryResult: QueryResult<{ total: number }>;
  cacheKey: any;
} {
  const dataParams = transactionParamsToRequest(
    { ...params, responseType: 'data' },
    { ignoreDefaultTimestamps: true },
  );
  const queryResult = useTransactionsListPaginated(dataParams, mapper) as QueryResult<
    PaginatedData<T>
  >;
  const countParams = transactionParamsToRequest(
    { ...params, page: 0, pageSize: 0, responseType: 'count' },
    { ignoreDefaultTimestamps: true },
  );
  const countQueryResult = useTransactionsCount(countParams) as QueryResult<{ total: number }>;
  return {
    queryResult,
    countQueryResult,
    cacheKey: TRANSACTIONS_LIST(params),
  };
}

export function useTransactionItem(transactionId: string): QueryResult<any> {
  const api = useApi();
  return useQuery(TRANSACTIONS_ITEM(transactionId), () => api.getTransaction({ transactionId }));
}

export function useTransactionAlerts(
  transactionId: string,
  extra?: Record<string, unknown>,
): QueryResult<any> {
  const api = useApi();
  return useQuery(TRANSACTIONS_ALERTS_LIST(transactionId), () =>
    api.getAlertList({ ...(extra ?? {}), filterTransactionIds: [transactionId] } as any),
  );
}

export function useTransactionArs(transactionId: string): QueryResult<any> {
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
  return usePaginatedQuery<InternalTransactionEvent>(
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
