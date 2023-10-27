import {
  CaseReasons,
  Case,
  CaseStatusChange,
  InternalBusinessUser,
  InternalConsumerUser,
  Comment,
} from '@/apis';

export type TableItem = Case & {
  index: number;
  userId: string | null;
  user: InternalConsumerUser | InternalBusinessUser | null;
  lastStatusChange?: CaseStatusChange;
  lastStatusChangeReasons: {
    reasons: CaseReasons[];
    otherReason: string | null;
  } | null;
  alertComments: Comment[];
};
