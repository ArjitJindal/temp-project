import {
  Case,
  CaseStatusChange,
  InternalBusinessUser,
  InternalConsumerUser,
  AllUsersTableItem,
  Comment,
  Alert,
  RiskLevel,
  CaseStatus,
} from '@/apis';

type TableConsumerUser = Pick<
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
>;

type TableBusinessUser = Pick<
  InternalBusinessUser,
  'type' | 'legalEntity' | 'userId' | 'userStateDetails' | 'kycStatusDetails' | 'tags'
>;

export type TableUser = AllUsersTableItem | TableConsumerUser | TableBusinessUser;

export function isAllUsersTableItem(user: TableUser): user is AllUsersTableItem {
  return 'name' in user;
}

export function isSpecificUserTableItem(
  user: TableUser,
): user is TableConsumerUser | TableBusinessUser {
  return !isAllUsersTableItem(user);
}

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
