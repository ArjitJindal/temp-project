import { RuleAction, TransactionState } from '@/apis';
import { SortOrder } from '@/components/ui/Table/types';

export type TableSearchParams = Partial<{
  page: number;
  sort: [string, SortOrder][];
  timestamp: string[];
  transactionId: string;
  rulesHitFilter: Array<string>;
  rulesExecutedFilter: Array<string>;
  originCurrenciesFilter: Array<string>;
  destinationCurrenciesFilter: Array<string>;
  userId: string;
  originUserId: string;
  destinationUserId: string;
  type: string;
  status: RuleAction;
  transactionState: TransactionState;
  originMethodFilter: string;
  destinationMethodFilter: string;
}>;
