import React, { useState } from 'react';
import { Params } from '../TransactionsSelector';
import { FIXED_API_PARAMS } from '../../InsightsCard';
import TransactionsTable from '@/pages/transactions/components/TransactionsTable';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { useDeepEqualEffect } from '@/utils/hooks';
import { map } from '@/utils/queries/types';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';

interface Props {
  userId: string;
  selectorParams: Params;
}

export default function TransactionsList(props: Props) {
  const { userId, selectorParams } = props;
  // todo: reset table params when selector params changed
  const [tableParams, setTableParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  useDeepEqualEffect(() => {
    let pageSize = DEFAULT_PAGE_SIZE;
    if (selectorParams.transactionsCount === 'LAST_10') {
      pageSize = 10;
    } else if (selectorParams.transactionsCount === 'LAST_50') {
      pageSize = 50;
    }
    setTableParams((state) => ({
      ...state,
      page: 1,
      pageSize,
    }));
  }, [selectorParams]);

  const api = useApi();
  const transactionListResponse = usePaginatedQuery(
    TRANSACTIONS_LIST({
      ...tableParams,
      ...selectorParams,
      userId,
    }),
    async (paginationParams) => {
      const { data, total } = await api.getTransactionsList({
        ...FIXED_API_PARAMS,
        ...tableParams,
        ...paginationParams,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        includeEvents: true,
        includeUsers: true,
      });
      return { items: data, total };
    },
  );
  const transactionList = map(transactionListResponse, (response) => {
    let { total } = response;
    if (selectorParams.transactionsCount === 'LAST_10') {
      total = Math.min(total ?? response.items.length, 10);
    } else if (selectorParams.transactionsCount === 'LAST_50') {
      total = Math.min(total ?? response.items.length, 50);
    }
    return {
      items: response.items,
      total: total,
    };
  });
  return (
    <TransactionsTable
      hideSearchForm
      disableSorting
      queryResult={transactionList}
      params={tableParams}
      onChangeParams={setTableParams}
    />
  );
}
