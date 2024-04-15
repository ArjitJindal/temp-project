import {
  AuditLogType,
  CaseReasons,
  CaseType,
  ChecklistStatus,
  PaymentMethod,
  Priority,
  RiskLevel,
  RuleAction,
  DerivedStatus,
  TransactionState,
  UserState,
} from '@/apis';
import { CommonParams } from '@/components/library/Table/types';
import { Mode as UserSearchMode } from '@/pages/transactions/components/UserSearchPopup/types';
import { ScopeSelectorValue } from '@/pages/case-management/components/ScopeSelector';

export type CommonCaseParams = {
  caseId: string;
  timestamp: string[];
  createdTimestamp: string[];
  caseCreatedTimestamp: string[];
  rulesHitFilter: Array<string>;
  rulesExecutedFilter: Array<string>;
  userFilterMode: UserSearchMode;
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
  qaAssignment: string[];
  updatedAt: string[];
  caseTypesFilter: CaseType[];
  filterQaStatus?: (ChecklistStatus | "NOT_QA'd")[];
  filterOutQaStatus?: ChecklistStatus[];
  filterClosingReason?: CaseReasons[];
  alertPriority: Priority[];
  ruleQueueIds?: string[];
  ruleNature?: string[];
  forensicsFor?: {
    alertId: string;
    caseId: string;
  };
  expandedAlertId?: string;
};

export type TableSearchParams = CommonParams & {
  showCases?: ScopeSelectorValue;
  qaMode?: boolean;
  filterAlertIds?: string[];
} & Partial<CommonCaseParams>;
