import { uniqBy } from 'lodash';
import { InternalTransaction, TenantSettings } from '@/apis';

export function isTransactionHasDetails(
  transaction: InternalTransaction,
  settings: TenantSettings,
) {
  if (settings.isPaymentApprovalEnabled && transaction.status === 'SUSPEND') {
    return true;
  }
  const detailsList = getFlatSanctionsDetails(transaction);
  return detailsList.length > 0;
}

export function getFlatSanctionsDetails(transaction: InternalTransaction) {
  return uniqBy(
    transaction.hitRules.flatMap((hitRule) => hitRule.ruleHitMeta?.sanctionsDetails ?? []),
    (x) => x.searchId,
  );
}
