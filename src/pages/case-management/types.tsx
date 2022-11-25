import { AuditLogType, RuleAction, TransactionState } from '@/apis';
import { SortOrder } from '@/components/ui/Table/types';
import { Mode as UserSearchMode } from '@/pages/transactions/components/UserSearchPopup/types';

export type TableSearchParams = Partial<{
  caseId: string;
  page: number;
  sort: [string, SortOrder][];
  timestamp: string[];
  rulesHitFilter: Array<string>;
  rulesExecutedFilter: Array<string>;
  originCurrenciesFilter: Array<string>;
  destinationCurrenciesFilter: Array<string>;
  userFilterMode: UserSearchMode;
  userId: string;
  type: string;
  status: RuleAction[];
  transactionState: TransactionState[];
  originMethodFilter: string;
  destinationMethodFilter: string;
  tagKey: string;
  tagValue: string;
  caseStatus: 'OPEN' | 'CLOSED';
  transactionId: string;
  filterTypes: AuditLogType[];
}>;
