import _ from 'lodash';
import { InternalTransaction } from '@/apis';

export function isTransactionHasDetails(transaction: InternalTransaction) {
  const detailsList = getFlatSanctionsDetails(transaction);
  return detailsList.length > 0;
}

export function getFlatSanctionsDetails(transaction: InternalTransaction) {
  return _.uniqBy(
    transaction.hitRules.flatMap((hitRule) => hitRule.ruleHitMeta?.sanctionsDetails ?? []),
    (x) => x.searchId,
  );
}
