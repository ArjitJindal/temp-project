import { TableUser } from '../CaseTable/types';
import { Alert, AlertStatus, CaseType } from '@/apis';

export interface TableAlertItem extends Omit<Alert, 'ruleChecklist'> {
  alertId?: string;
  caseId?: string;
  caseCreatedTimestamp?: number;
  caseUserName?: string;
  age?: number;
  caseUserId: string;
  caseType: CaseType;
  proposedAction?: AlertStatus;
  user?: TableUser;
  lastStatusChangeReasons?: {
    reasons: string[];
    otherReason: string | null;
  };
  checkerAction?: string;
}
