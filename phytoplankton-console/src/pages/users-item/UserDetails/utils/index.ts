import { useConsoleUser } from '@/hooks/api';
import SalesForceIcon from '@/components/ui/icons/salesforce.react.svg';
import FreshdeskIcon from '@/components/ui/icons/freshdesk.react.svg';
import ZendeskIcon from '@/components/ui/icons/zendesk.react.svg';

export { useConsoleUser };

export const CRM_ICON_MAP = {
  FRESHDESK: FreshdeskIcon,
  SALESFORCE: SalesForceIcon,
  ZENDESK: ZendeskIcon,
} as const;

export const getModelName = (model) => {
  switch (model) {
    case 'SalesforceTicket':
      return 'Salesforce';
    case 'FreshDeskTicket':
      return 'Freshdesk';
    default:
      return 'Zendesk';
  }
};
