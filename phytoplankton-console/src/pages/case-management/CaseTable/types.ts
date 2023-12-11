import {
  CaseReasons,
  Case,
  CaseStatusChange,
  InternalBusinessUser,
  InternalConsumerUser,
  Comment,
  Alert,
} from '@/apis';

export type TableItem = Omit<Case, 'alerts'> & {
  index: number;
  userId: string | null;
  user: InternalConsumerUser | InternalBusinessUser | null;
  lastStatusChange?: CaseStatusChange;
  lastStatusChangeReasons: {
    reasons: CaseReasons[];
    otherReason: string | null;
  } | null;
  alertComments: Comment[];
  alerts?: Omit<Alert, 'transactionIds'>[];
};
