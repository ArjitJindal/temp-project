import {
  AuditLogType,
  KYCStatus,
  RiskLevel,
  RuleAction,
  TransactionState,
  UserState,
} from '@/apis';
import { CommonParams } from '@/components/ui/Table';
import { Mode as UserSearchMode } from '@/pages/transactions/components/UserSearchPopup/types';

export type CaseSearchParams = CommonParams & {
  showCases: 'MY' | 'ALL';
} & Partial<{
    caseId: string;
    timestamp: string[];
    createdTimestamp: string[];
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
    transactionTimestamp: string[];
    amountGreaterThanFilter: number;
    amountLessThanFilter: number;
    originCountryFilter: string;
    destinationCountryFilter: string;
    businessIndustryFilter: string[];
    filterTypes: AuditLogType[];
    kycStatuses: KYCStatus[];
    userStates: UserState[];
    riskLevels: RiskLevel[];
  }>;

export type AlertSearchParams = CommonParams & {
  showCases: 'MY_ALERTS';
} & Partial<{
    alertId: string;
    caseStatus: 'OPEN' | 'CLOSED';
  }>;

export type TableSearchParams = AlertSearchParams | CaseSearchParams;
