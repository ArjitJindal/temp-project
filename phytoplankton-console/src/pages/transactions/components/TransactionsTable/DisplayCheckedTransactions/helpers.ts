import { Alert, TransactionTableItem } from '@/apis';
import {
  transactionParamsToRequest,
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { QueryResult } from '@/utils/queries/types';
import { CursorPaginatedData, useCursorQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';

export function useCheckedTransactionsQuery(
  alert: Alert,
  caseUserId: string,
  params: TransactionsTableParams = DEFAULT_PARAMS_STATE,
): QueryResult<CursorPaginatedData<TransactionTableItem>> {
  const api = useApi();

  return useCursorQuery(TRANSACTIONS_LIST({ ...params, caseUserId }), async ({ from, view }) => {
    const hitDirections = alert.ruleHitMeta?.hitDirections;
    return await api.getTransactionsList({
      ...transactionParamsToRequest({ ...params, view }),
      start: from || params.from,
      ...(hitDirections?.length === 1
        ? {
            filterDestinationUserId: hitDirections?.includes('DESTINATION')
              ? caseUserId
              : undefined,
            filterOriginUserId: hitDirections?.includes('ORIGIN') ? caseUserId : undefined,
          }
        : { filterUserId: caseUserId }),
      filterRuleInstancesExecuted: [alert.ruleInstanceId],
    });
  });
}
