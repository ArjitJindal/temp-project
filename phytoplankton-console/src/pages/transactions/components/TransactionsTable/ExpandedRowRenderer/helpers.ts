import { uniqBy } from 'lodash';
import { InternalTransaction, TenantSettings, TransactionTableItem } from '@/apis';

export function isTransactionHasDetails(
  transaction: TransactionTableItem,
  settings: TenantSettings,
) {
  if (settings.isPaymentApprovalEnabled && transaction.status === 'SUSPEND') {
    return true;
  }

  return !!transaction.isAnySanctionsExecutedRules;
}

export function getFlatSanctionsDetails(transaction: InternalTransaction) {
  return uniqBy(
    transaction.hitRules.flatMap((hitRule) => hitRule.ruleHitMeta?.sanctionsDetails ?? []),
    (x) => x.searchId,
  );
}
