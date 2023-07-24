import {
  AlertStatus,
  AuditLogType,
  CaseStatus,
  PaymentMethod,
  RiskLevel,
  RuleAction,
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
  originCurrenciesFilter: Array<string>;
  destinationCurrenciesFilter: Array<string>;
  userFilterMode: UserSearchMode;
  userId: string;
  type: string;
  status: RuleAction[];
  transactionState: TransactionState[];
  originMethodFilter: PaymentMethod[];
  destinationMethodFilter: PaymentMethod[];
  tagKey: string;
  tagValue: string;
  caseStatus: CaseStatus;
  alertStatus: AlertStatus;
  transactionId: string;
  transactionTimestamp: string[];
  amountGreaterThanFilter: number;
  amountLessThanFilter: number;
  originCountryFilter: string;
  destinationCountryFilter: string;
  businessIndustryFilter: string[];
  filterTypes: AuditLogType[];
  userStates: UserState[];
  riskLevels: RiskLevel[];
  alertId: string;
  assignedTo: string[];
  updatedAt: string[];
};

export type TableSearchParams = CommonParams & {
  showCases?: ScopeSelectorValue;
} & Partial<CommonCaseParams>;
