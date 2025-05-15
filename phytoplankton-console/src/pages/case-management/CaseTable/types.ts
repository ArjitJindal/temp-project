import {
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
      | 'type'
      | 'userDetails'
      | 'userId'
      | 'userStateDetails'
      | 'kycStatusDetails'
      | 'tags'
      | 'pepStatus'
      | 'sanctionsStatus'
      | 'adverseMediaStatus'
    >
  | Pick<
      InternalBusinessUser,
      'type' | 'legalEntity' | 'userId' | 'userStateDetails' | 'kycStatusDetails' | 'tags'
    >;

export type TableItem = Omit<Case, 'alerts' | 'caseUsers'> & {
  index: number;
  userId: string | null;
  user: TableUser | null;
  lastStatusChange?: CaseStatusChange;
  lastStatusChangeReasons: {
    reasons: string[];
    otherReason: string | null;
  } | null;
  alertComments: Comment[];
  alerts?: Omit<Alert, 'transactionIds' | 'ruleChecklist'>[];
  userRiskLevel?: RiskLevel;
  proposedAction?: CaseStatus;
};
