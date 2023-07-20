import { useState } from 'react';
import TransactionsTable, {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useCursorQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import PaymentApprovalButton from '@/pages/case-management/components/PaymentApprovalButton';

export default function PaymentApprovalsTable() {
  const [params, setParams] = useState<TransactionsTableParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [['timestamp', 'descend']],
  });
  const api = useApi();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryResult = useCursorQuery(TRANSACTIONS_LIST(params), async ({ from }) => {
    return await api.getTransactionsList({
      ...transactionParamsToRequest(params),
      filterStatus: ['SUSPEND'],
      start: from,
    });
  });

  return (
    <TransactionsTable
      queryResult={queryResult}
      params={params}
      onChangeParams={setParams}
      fitHeight={370}
      selectedIds={selectedIds}
      onSelect={setSelectedIds}
      paginationBorder
      selectionInfo={
        selectedIds.length
          ? {
              entityCount: selectedIds.length,
              entityName: 'transactions',
            }
          : undefined
      }
      selectionActions={[
        () => <PaymentApprovalButton ids={selectedIds} action={'BLOCK'} />,
        () => <PaymentApprovalButton ids={selectedIds} action={'ALLOW'} />,
      ]}
    />
  );
}
