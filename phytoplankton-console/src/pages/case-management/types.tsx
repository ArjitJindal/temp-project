import {
  AuditLogType,
  CaseReasons,
  CaseType,
  ChecklistStatus,
  DerivedStatus,
  PaymentMethod,
  Priority,
  RiskLevel,
  RuleAction,
  SLAPolicyStatus,
  TransactionState,
  UserState,
} from '@/apis';
import { CommonParams } from '@/components/library/Table/types';
import { ScopeSelectorValue } from '@/pages/case-management/components/ScopeSelector';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';

export type CommonCaseParams = {
  caseId: string;
  timestamp: string[];
  createdTimestamp: (string | undefined)[];
  caseCreatedTimestamp: string[];
  rulesHitFilter: Array<string>;
  rulesExecutedFilter: Array<string>;
  userId: string;
  status: RuleAction[];
  transactionState: TransactionState[];
  originMethodFilter: PaymentMethod[];
  destinationMethodFilter: PaymentMethod[];
  tagKey: string;
  tagValue: string;
  caseStatus: DerivedStatus[] | null;
  alertStatus: DerivedStatus[] | null;
  businessIndustryFilter: string[];
  filterTypes: AuditLogType[];
  userStates: UserState[];
  riskLevels: RiskLevel[];
  alertId: string;
  assignedTo: string[];
  roleAssignedTo: string[];
  qaAssignment: string[];
  updatedAt: string[];
  caseTypesFilter: CaseType[];
  filterQaStatus?: ChecklistStatus | "NOT_QA'd";
  filterClosingReason?: CaseReasons[];
  alertPriority: Priority[];
  ruleQueueIds?: string[];
  ruleNature?: string[];
  forensicsFor?: {
    alertId: string;
    caseId: string;
  };
  expandedAlertId?: string;
  filterCaseSlaPolicyId?: string[];
  filterCaseSlaPolicyStatus?: SLAPolicyStatus[];
  filterAlertSlaPolicyId?: string[];
  filterAlertSlaPolicyStatus?: SLAPolicyStatus[];
};

export type TableSearchParams = CommonParams & {
  showCases?: ScopeSelectorValue;
  qaMode?: boolean;
  filterAlertIds?: string[];
  paymentApprovals?: TransactionsTableParams;
} & Partial<CommonCaseParams>;
