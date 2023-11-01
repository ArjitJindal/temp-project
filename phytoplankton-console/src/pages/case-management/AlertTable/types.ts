import { Alert, CaseType, InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';

export interface TableAlertItem extends Alert {
  alertId?: string;
  caseId?: string;
  caseCreatedTimestamp?: number;
  caseUserName?: string;
  age?: string;
  caseUserId: string;
  caseType: CaseType;
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
}
