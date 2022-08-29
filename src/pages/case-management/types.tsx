import { RuleAction, TransactionState } from '@/apis';
import '../../components/ui/colors';

export type TableSearchParams = Partial<{
  current: number;
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
