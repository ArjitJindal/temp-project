import React, { useState } from 'react';
import { Params } from '../TransactionsSelector';
import { FIXED_API_PARAMS } from '..';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useApi } from '@/api';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { useDeepEqualEffect } from '@/utils/hooks';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { useApiTime } from '@/utils/tracker';

interface Props {
  userId: string;
  selectorParams: Params;
}

export default function TransactionsList(props: Props) {
  const { userId, selectorParams } = props;
  // todo: reset table params when selector params changed
  const [tableParams, setTableParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);
  const measure = useApiTime();
  useDeepEqualEffect(() => {
    const pageSize = DEFAULT_PAGE_SIZE;

    setTableParams((state) => ({
      ...state,
      page: 1,
      pageSize,
    }));
  }, [selectorParams]);

  const api = useApi();
  const queryResult = useCursorQuery(
    TRANSACTIONS_LIST({
      ...tableParams,
      ...selectorParams,
      userId,
    }),

    async () => {
      return await measure(
        () =>
          api.getTransactionsList({
            ...FIXED_API_PARAMS,
            ...tableParams,
            first: tableParams.pageSize,
            _from: tableParams.from,
            filterUserId: userId,
            filterStatus: selectorParams.selectedRuleActions,
            includeEvents: true,
            includeUsers: true,
          }),
        'Get transactions list',
      );
    },
  );

  return (
    <TransactionsTable
      hideSearchForm
      disableSorting
      queryResult={queryResult}
      params={tableParams}
      onChangeParams={setTableParams}
      fitHeight={300}
    />
  );
}
