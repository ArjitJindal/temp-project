import { TransactionType } from '@/apis';
import { neverReturn } from '@/utils/lang';

export function isTransactionType(value: unknown): value is TransactionType {
  const transactionType = value as TransactionType;
  switch (transactionType) {
    case 'DEPOSIT':
    case 'EXTERNAL_PAYMENT':
    case 'WITHDRAWAL':
    case 'REFUND':
    case 'TRANSFER':
      return true;
  }

  return neverReturn(transactionType, false);
}
