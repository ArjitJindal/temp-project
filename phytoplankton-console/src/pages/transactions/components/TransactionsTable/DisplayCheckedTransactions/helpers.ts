import { Alert } from '@/apis';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useTransactionsQuery } from '@/hooks/api/transactions';

export function useCheckedTransactionsQuery(
  alert: Alert,
  caseUserId: string,
  params: TransactionsTableParams = DEFAULT_PARAMS_STATE,
) {
  const hitDirections = alert.ruleHitMeta?.hitDirections;
  const newParams: TransactionsTableParams = {
    ...params,
    filterRuleInstancesExecuted: [alert.ruleInstanceId],
  };

  if (hitDirections?.length === 1) {
    newParams.direction = hitDirections?.includes('DESTINATION') ? 'incoming' : 'outgoing';
  } else {
    newParams.direction = 'all';
  }
  newParams.userId = caseUserId;

  return useTransactionsQuery(newParams);
}
