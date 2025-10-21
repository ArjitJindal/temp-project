import {
  QuestionResponse,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { ChecklistDoneStatus, ChecklistStatus, ChecklistItem as EmptyChecklistItem } from '@/apis';

export type HistoryItem = QuestionResponse | QuestionResponseSkeleton;

export type ChecklistItem = EmptyChecklistItem & {
  qaStatus?: ChecklistStatus;
  done: ChecklistDoneStatus;
  comment?: string;
};

export type ChecklistCategory = {
  name: string;
  items: ChecklistItem[];
};

export type HydratedChecklist = ChecklistCategory[];
