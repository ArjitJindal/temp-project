import { ChecklistDoneStatus, ChecklistStatus } from '@/apis';
import { useAlertChecklist } from '@/hooks/api';

export { useAlertChecklist };

export type ChecklistItem = {
  id?: string;
  name?: string;
  level?: string;
  qaStatus?: ChecklistStatus;
  done: ChecklistDoneStatus;
  comment?: string;
};

type ChecklistCategory = {
  name: string;
  items: ChecklistItem[];
};

export type HydratedChecklist = ChecklistCategory[];
