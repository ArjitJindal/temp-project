import { TransactionState } from '@/apis';

export const TRANSACTION_STATES: TransactionState[] = [
  'CREATED',
  'PROCESSING',
  'SENT',
  'EXPIRED',
  'DECLINED',
  'SUSPENDED',
  'REFUNDED',
  'SUCCESSFUL',
];
