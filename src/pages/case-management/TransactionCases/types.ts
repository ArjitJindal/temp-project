import { Case, CaseStatusChange, CaseTransaction, RuleAction } from '@/apis';

export type TableItem = Case & {
  index: number;
  rowKey: string;
  ruleName?: string | null;
  ruleDescription?: string | null;
  ruleAction?: RuleAction | null;
  transaction: CaseTransaction | null;
  transactionFirstRow: boolean;
  transactionsRowsCount: number;
  lastStatusChange: CaseStatusChange | null;
};
