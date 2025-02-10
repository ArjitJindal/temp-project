import { TableUser } from '../CaseTable/types';
import { Alert, AlertStatus, CaseType } from '@/apis';

export interface TableAlertItem extends Omit<Alert, 'transactionIds' | 'ruleChecklist'> {
  alertId?: string;
  caseId?: string;
  caseCreatedTimestamp?: number;
  caseUserName?: string;
  age?: string;
  caseUserId: string;
  caseType: CaseType;
  proposedAction?: AlertStatus;
  user?: TableUser;
  lastStatusChangeReasons?: {
    reasons: string[];
    otherReason: string | null;
  };
}
