import React, { useState } from 'react';
import { Params } from '../TransactionsSelector';
import { FIXED_API_PARAMS } from '..';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useApi } from '@/api';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGINATION_VIEW,
  DEFAULT_PARAMS_STATE,
} from '@/components/library/Table/consts';
import { useDeepEqualEffect } from '@/utils/hooks';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { dayjs } from '@/utils/dayjs';

interface Props {
  userId: string;
  selectorParams: Params;
}

export default function TransactionsList(props: Props) {
  const { userId, selectorParams } = props;
  // todo: reset table params when selector params changed
  const [tableParams, setTableParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    timestamp: [dayjs().subtract(3, 'month').startOf('day'), dayjs().endOf('day')].map((x) =>
      x.format(),
    ),
    sort: [['timestamp', 'descend']],
  });
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
    TRANSACTIONS_LIST({ ...tableParams, ...selectorParams, userId }),

    async ({ from, view }) => {
      return await api.getTransactionsList({
        ...FIXED_API_PARAMS,
        ...transactionParamsToRequest(tableParams),
        pageSize: tableParams.pageSize,
        start: from || tableParams.from,
        filterUserId: userId,
        filterStatus: selectorParams.selectedRuleActions,
        filterTransactionState: selectorParams.selectedTransactionStates,
        includeUsers: true,
        view: view ?? DEFAULT_PAGINATION_VIEW,
      });
    },
  );

  return (
    <TransactionsTable
      queryResult={queryResult}
      params={tableParams}
      onChangeParams={setTableParams}
      fitHeight={300}
      extraFilters={[
        {
          key: 'userId',
          title: 'User ID/name',
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              userId={params.userId ?? null}
              onConfirm={(userId) => {
                setParams((state) => ({
                  ...state,
                  userId: userId ?? undefined,
                }));
              }}
            />
          ),
        },
      ]}
    />
  );
}
