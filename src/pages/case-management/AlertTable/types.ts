import { Alert } from '@/apis';

export interface TableAlertItem extends Alert {
  alertId?: string;
  caseId?: string;
  caseCreatedTimestamp?: number;
  caseUserName?: string;
  age?: string;
}
