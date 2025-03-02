import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import PaymentApprovalButton from '@/pages/case-management/components/PaymentApprovalButton';
import { TransactionsResponse } from '@/apis';

interface Props {
  params: TransactionsTableParams;
  onChangeParams: (newState: TransactionsTableParams) => void;
}

export default function PaymentApprovalsTable(props: Props) {
  const { params, onChangeParams: setParams } = props;
  const api = useApi({ debounce: 500 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const filterStatus = [params.status ?? 'SUSPEND'];
  const queryKey = TRANSACTIONS_LIST({ ...params, filterStatus });
  const queryResult = useCursorQuery(queryKey, async ({ from }) => {
    return await api.getTransactionsList({
      ...transactionParamsToRequest(params, { ignoreDefaultTimestamps: true }),
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
      hideStatusFilter={true}
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
