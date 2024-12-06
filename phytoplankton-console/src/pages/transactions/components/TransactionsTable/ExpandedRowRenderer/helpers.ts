import { TenantSettings, TransactionTableItem } from '@/apis';

export function isTransactionHasDetails(
  transaction: TransactionTableItem,
  settings: TenantSettings,
) {
  if (settings.isPaymentApprovalEnabled && transaction.status === 'SUSPEND') {
    return true;
  }

  return !!transaction.isAnySanctionsExecutedRules;
}
