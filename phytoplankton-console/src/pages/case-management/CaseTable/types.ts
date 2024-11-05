import {
  CaseReasons,
  Case,
  CaseStatusChange,
  InternalBusinessUser,
  InternalConsumerUser,
  Comment,
  Alert,
  RiskLevel,
  CaseStatus,
} from '@/apis';

export type TableUser =
  | Pick<
      InternalConsumerUser,
      'type' | 'userDetails' | 'userId' | 'userStateDetails' | 'kycStatusDetails'
    >
  | Pick<
      InternalBusinessUser,
      'type' | 'legalEntity' | 'userId' | 'userStateDetails' | 'kycStatusDetails'
    >;

export type TableItem = Omit<Case, 'alerts' | 'caseUsers'> & {
  index: number;
  userId: string | null;
  user: TableUser | null;
  lastStatusChange?: CaseStatusChange;
  lastStatusChangeReasons: {
    reasons: CaseReasons[];
    otherReason: string | null;
  } | null;
  alertComments: Comment[];
  alerts?: Omit<Alert, 'transactionIds' | 'ruleChecklist'>[];
  userRiskLevel?: RiskLevel;
  proposedAction?: CaseStatus;
};
