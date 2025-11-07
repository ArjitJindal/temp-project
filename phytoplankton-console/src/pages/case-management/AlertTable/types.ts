import { TableUser } from '../CaseTable/types';
import { Alert, AlertStatus, CaseAddress, CaseEmail, CasePaymentDetails, CaseType } from '@/apis';

export interface TableAlertItem extends Omit<Alert, 'ruleChecklist'> {
  address?: CaseAddress;
  email?: CaseEmail;
  name?: CaseEmail;
  paymentDetails?: CasePaymentDetails;
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
