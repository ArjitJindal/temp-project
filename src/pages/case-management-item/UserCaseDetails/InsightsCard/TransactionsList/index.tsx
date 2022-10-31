import React, { useState } from 'react';
import { Params } from '../TransactionsSelector';
import { FIXED_API_PARAMS } from '../../InsightsCard';
import TransactionsTable from '@/pages/transactions/components/TransactionsTable';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { CommonParams } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { useDeepEqualEffect } from '@/utils/hooks';
import { map } from '@/utils/queries/types';

interface Props {
  userId: string;
  selectorParams: Params;
}

export default function TransactionsList(props: Props) {
  const { userId, selectorParams } = props;
  // todo: reset table params when selector params changed
  const [tableParams, setTableParams] = useState<CommonParams>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: [],
  });

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
  const transactionListResponse = useQuery(
    TRANSACTIONS_LIST({
      ...tableParams,
      ...selectorParams,
      userId,
    }),
    () =>
      api.getTransactionsList({
        ...FIXED_API_PARAMS,
        limit: tableParams.pageSize,
        skip: ((tableParams?.page ?? 1) - 1) * tableParams.pageSize,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        includeEvents: true,
        includeUsers: true,
      }),
  );
  const transactionList = map(transactionListResponse, (response) => {
    let total = response.total;
    if (selectorParams.transactionsCount === 'LAST_10') {
      total = Math.min(total, 10);
    } else if (selectorParams.transactionsCount === 'LAST_50') {
      total = Math.min(total, 50);
    }
    return {
      items: response.data,
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
