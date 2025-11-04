import { TransactionTableItem } from '@/apis';

export type UseTransactionsQueryParams<T extends object = TransactionTableItem> = {
  isReadyToFetch?: boolean;
  debounce?: number;
  mapper?: (data: TransactionTableItem[]) => T[];
};
