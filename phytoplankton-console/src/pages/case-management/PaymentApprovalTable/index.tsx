import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import PaymentApprovalButton from '@/pages/case-management/components/PaymentApprovalButton';
import { RuleAction, TransactionsResponse } from '@/apis';

interface Props {
  filterStatus?: Array<RuleAction>;
}

export default function PaymentApprovalsTable(props: Props) {
  const { filterStatus = ['SUSPEND'] } = props;
  const [params, setParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });
  const api = useApi();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const queryKey = TRANSACTIONS_LIST({ ...params, filterStatus });
  const queryResult = useCursorQuery(queryKey, async ({ from }) => {
    return await api.getTransactionsList({
      ...transactionParamsToRequest(params),
      filterStatus,
      start: from || params.from,
    });
  });

  const updateCacheData = useCallback(() => {
    const queryState = queryClient.getQueryState(queryKey);
    const pageParam = (queryState as any)?.state?.data?.pageParam ?? '';
    const fullQueryKey = [...queryKey, { pageParam }];
    queryClient.setQueryData<TransactionsResponse>(
      fullQueryKey,
      (data: TransactionsResponse | undefined): TransactionsResponse | undefined => {
        if (data == null) {
          return undefined;
        }
        return {
          ...data,
          items: data.items.filter((x) => !selectedIds.includes(x.transactionId)),
        };
      },
    );
  }, [queryKey, selectedIds, queryClient]);

  return (
    <TransactionsTable
      queryResult={queryResult}
      params={params}
      onChangeParams={setParams}
      fitHeight={370}
      selectedIds={selectedIds}
      onSelect={setSelectedIds}
      isExpandable
      paginationBorder
      selectionInfo={
        selectedIds.length
          ? { entityCount: selectedIds.length, entityName: 'transactions' }
          : undefined
      }
      selectionActions={[
        ({ selectedIds, onResetSelection }) => (
          <PaymentApprovalButton
            ids={selectedIds}
            action={'BLOCK'}
            onSuccess={() => {
              onResetSelection();
              updateCacheData();
              queryResult.refetch();
            }}
          />
        ),
        ({ selectedIds, onResetSelection }) => (
          <PaymentApprovalButton
            ids={selectedIds}
            action={'ALLOW'}
            onSuccess={() => {
              onResetSelection();
              updateCacheData();
              queryResult.refetch();
            }}
          />
        ),
      ]}
      canSelectRow={(row) => row.content.status === 'SUSPEND'}
    />
  );
}
