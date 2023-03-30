import {
  CaseClosingReasons,
  Case,
  CaseStatusChange,
  InternalBusinessUser,
  InternalConsumerUser,
} from '@/apis';

export type TableItem = Case & {
  index: number;
  userId: string | null;
  user: InternalConsumerUser | InternalBusinessUser | null;
  lastStatusChange?: CaseStatusChange;
  lastStatusChangeReasons: {
    reasons: CaseClosingReasons[];
    otherReason: string | null;
  } | null;
};
