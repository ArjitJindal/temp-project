import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useMemo } from 'react';
import { QueryKey } from '@tanstack/react-query';
import { Currency } from '@flagright/lib/constants';
import { UseTransactionsQueryParams } from './types';
import { TransactionsUniquesField } from '@/apis/models/TransactionsUniquesField';
import { useApi } from '@/api';
import { PaginatedData, usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import {
  TRANSACTIONS_UNIQUES,
  TRANSACTIONS_LIST,
  CASE_TRANSACTIONS_LIST,
  TRANSACTIONS_COUNT,
  TRANSACTIONS_ITEM,
  TRANSACTIONS_STATS,
  TRANSACTIONS_EVENTS_FIND,
} from '@/utils/queries/keys';
import { Option } from '@/components/library/Select';
import {
  TransactionsTableParams,
  transactionParamsToRequest,
} from '@/pages/transactions/components/TransactionsTable';
import { QueryResult } from '@/utils/queries/types';
import {
  TransactionsStatsByTimeResponseData,
  TransactionsStatsByTypesResponseData,
  TransactionTableItem,
} from '@/apis';
import { FIXED_API_PARAMS } from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { Params } from '@/pages/case-management-item/CaseDetails/InsightsCard/TransactionsSelector';
import { CommonParams } from '@/components/library/Table/types';

export const useTransactionsUniques = ({
  field,
  params,
  optionise,
}: {
  field: TransactionsUniquesField;
  params?: { filter?: string };
  optionise?: boolean;
}) => {
  const api = useApi();
  return useQuery<string[] | Option<string>[]>(TRANSACTIONS_UNIQUES(field, params), async () => {
    const uniques = await api.getTransactionsUniques({
      field,
      filter: params?.filter ?? undefined,
    });
    const filteredUniques = uniques.filter((value) => value?.length > 0);
    return optionise
      ? filteredUniques.map((value) => ({ value, label: humanizeAuto(value) }))
      : filteredUniques;
  });
};

export const useTransactionList = ({ params }: { params: any }) => {
  const api = useApi();
  return useQuery(TRANSACTIONS_LIST(params), async () => {
    return api.getTransactionsList(params);
  });
};

export function usePaginatedTransactionList<T extends object = TransactionTableItem>(
  params: TransactionsTableParams,
  { isReadyToFetch, debounce, mapper }: UseTransactionsQueryParams<T> = {},
): {
  queryResult: QueryResult<PaginatedData<T>>;
  countQueryResult: QueryResult<{ total: number }>;
  cacheKey: QueryKey;
} {
  const api = useApi({ ...(debounce ? { debounce } : undefined) });

  const queryResultOffset = usePaginatedQuery<T>(
    TRANSACTIONS_LIST({ ...params, ...(mapper ? { mapper: mapper.toString() } : {}) }),
    async (paginationParams) => {
      const data = await api.getTransactionsList({
        ...transactionParamsToRequest(
          { ...params, view: paginationParams.view, responseType: 'data' },
          { ignoreDefaultTimestamps: true },
        ),
        ...paginationParams,
      });

      return {
        items: (mapper ? mapper(data.items) : data.items) as T[],
        total: data.count ? parseInt(`${data.count}`) : 0,
      };
    },
    { enabled: isReadyToFetch },
  );
  const countParams = useMemo(() => {
    return {
      ...params,
      page: 0,
      pageSize: 0,
    };
  }, [params]);
  const countQueryResult = useQuery<{ total: number }>(
    TRANSACTIONS_COUNT(countParams),
    async () => {
      const countData = await api.getTransactionsList({
        ...transactionParamsToRequest(
          { ...countParams, responseType: 'count' },
          { ignoreDefaultTimestamps: true },
        ),
      });

      return {
        total: parseInt(`${countData.count}`),
      };
    },
    {
      enabled: isReadyToFetch,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  );

  return {
    queryResult: queryResultOffset,
    countQueryResult,
    cacheKey: TRANSACTIONS_LIST(params),
  };
}

export const useCaseTransactionsList = ({ params }: { params }) => {
  const api = useApi();
  return useQuery(CASE_TRANSACTIONS_LIST(params), async () => {
    return api.getCaseTransactions(params);
  });
};

export const useTransactionDetails = (transactionId: string) => {
  const api = useApi();
  return useQuery(
    TRANSACTIONS_ITEM(transactionId),
    async () => {
      return api.getTransaction({ transactionId });
    },
    {
      enabled: !!transactionId,
    },
  );
};

export const useTransactionStats = ({
  type,
  selectorParams,
  referenceCurrency,
  userId,
}: {
  type: 'by-type' | 'by-date';
  selectorParams: Params;
  referenceCurrency: Currency;
  userId: string;
}): QueryResult<TransactionsStatsByTypesResponseData[] | TransactionsStatsByTimeResponseData[]> => {
  const api = useApi();
  const requestParams = {
    ...FIXED_API_PARAMS,
    ...(selectorParams.transactionsCount !== undefined && {
      pageSize: selectorParams.transactionsCount,
    }),
    filterUserId: userId,
    filterStatus: selectorParams.selectedRuleActions,
    filterTransactionState: selectorParams.selectedTransactionStates,
    referenceCurrency,
    afterTimestamp: selectorParams.timeRange?.[0]?.valueOf(),
    beforeTimestamp: selectorParams.timeRange?.[1]?.valueOf(),
    caseSubject: selectorParams.caseSubject,
    entityId: selectorParams.entityId,
  };
  return useQuery(
    TRANSACTIONS_STATS(type, { ...selectorParams, referenceCurrency, userId }),
    async (): Promise<
      TransactionsStatsByTimeResponseData[] | TransactionsStatsByTypesResponseData[]
    > => {
      if (type === 'by-date') {
        const response = await api.getTransactionsStatsByTime({
          ...requestParams,
          aggregateBy: selectorParams.aggregateBy,
        });
        return response.data;
      }
      const response = await api.getTransactionsStatsByType(requestParams);
      return response.data;
    },
  );
};

export const usePaginatedTransactionEvents = ({
  transactionId,
  params,
}: {
  transactionId: string;
  params: CommonParams;
}) => {
  const api = useApi();
  return usePaginatedQuery(TRANSACTIONS_EVENTS_FIND(transactionId, params), async (params) => {
    return api.getTransactionEvents({ transactionId, ...params });
  });
};
