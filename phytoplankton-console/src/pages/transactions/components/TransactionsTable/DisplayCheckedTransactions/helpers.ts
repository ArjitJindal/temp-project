import { Alert } from '@/apis';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useTransactionsQuery } from '@/pages/transactions/utils';

export function useCheckedTransactionsQuery(
  alert: Alert,
  caseUserId: string,
  params: TransactionsTableParams = DEFAULT_PARAMS_STATE,
) {
  const hitDirections = alert.ruleHitMeta?.hitDirections;
  return useTransactionsQuery(
    {
      ...params,
      ...(hitDirections?.length === 1
        ? {
            filterDestinationUserId: hitDirections?.includes('DESTINATION')
              ? caseUserId
              : undefined,
            filterOriginUserId: hitDirections?.includes('ORIGIN') ? caseUserId : undefined,
          }
        : { filterUserId: caseUserId }),
      filterRuleInstancesExecuted: [alert.ruleInstanceId],
    },
    { isReadyToFetch: true },
  );
}
