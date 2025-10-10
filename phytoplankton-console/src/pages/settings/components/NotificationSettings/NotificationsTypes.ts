import { NotificationType } from '@/apis';

type NotificationEntityType = 'GENERAL'; // Add 'USERS', 'RULES_LIBRARY', 'RISK_SCORING' during implementation

interface Option<T> {
  label: string;
  value: T[];
}

export const NOTIFICATION_TYPES: {
  [key in NotificationEntityType]: Array<Option<NotificationType>>;
} = {
  GENERAL: [
    {
      label: 'When a case/alert is assigned to your account.',
      value: ['CASE_ASSIGNMENT', 'ALERT_ASSIGNMENT'],
    },
    {
      label: 'When a case/alert is unassigned from your account',
      value: ['ALERT_UNASSIGNMENT', 'CASE_UNASSIGNMENT'],
    },
    {
      label: 'When a case/alert is escalated to your account.',
      value: ['CASE_ESCALATION', 'ALERT_ESCALATION'],
    },
    {
      label: 'When a case/alert is sent for review to your account.',
      value: ['ALERT_IN_REVIEW', 'CASE_IN_REVIEW'],
    },
    {
      label: 'When your account is mentioned by another account.',
      value: ['CASE_COMMENT_MENTION', 'USER_COMMENT_MENTION', 'ALERT_COMMENT_MENTION'],
    },
    {
      label: 'When there is any update in the case/alert you are assigned to.',
      value: ['ALERT_STATUS_UPDATE', 'CASE_STATUS_UPDATE', 'CASE_COMMENT', 'ALERT_COMMENT'],
    },
    {
      label: 'When a change to risk levels requires approval.',
      value: ['RISK_CLASSIFICATION_APPROVAL'],
    },
    {
      label: 'When a change to a risk factor requires approval.',
      value: ['RISK_FACTORS_APPROVAL'],
    },
    {
      label: 'When a change to a user field requires approval.',
      value: ['USER_CHANGES_APPROVAL'],
    },
  ],
};
