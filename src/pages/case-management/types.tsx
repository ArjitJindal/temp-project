import { RuleAction, TransactionState } from '@/apis';
import { SortOrder } from '@/components/ui/Table/types';
import { Mode as UserSearchMode } from '@/pages/transactions/components/UserSearchPopup/types';

export type TableSearchParams = Partial<{
  page: number;
  sort: [string, SortOrder][];
  timestamp: string[];
  transactionId: string;
  rulesHitFilter: Array<string>;
  rulesExecutedFilter: Array<string>;
  originCurrenciesFilter: Array<string>;
  destinationCurrenciesFilter: Array<string>;
  userFilterMode: UserSearchMode;
  userId: string;
  type: string;
  status: RuleAction;
  transactionState: TransactionState;
  originMethodFilter: string;
  destinationMethodFilter: string;
}>;
