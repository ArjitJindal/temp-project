import { Alert } from '@/apis';

export interface TableAlertItem extends Alert {
  caseCreatedTimestamp?: number;
  caseUserName?: string;
  age?: string;
}
