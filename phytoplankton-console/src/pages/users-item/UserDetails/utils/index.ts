import { useApi } from '@/api';
import { InternalConsumerUser, InternalBusinessUser } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ITEM } from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import SalesForceIcon from '@/components/ui/icons/salesforce.react.svg';
import FreshdeskIcon from '@/components/ui/icons/freshdesk.react.svg';
import ZendeskIcon from '@/components/ui/icons/zendesk.react.svg';

export const useConsoleUser = (
  id?: string,
): QueryResult<InternalConsumerUser | InternalBusinessUser> => {
  const api = useApi();
  return useQuery<InternalConsumerUser | InternalBusinessUser>(USERS_ITEM(id), () => {
    if (id == null) {
      throw new Error(`Id is not defined`);
    }
    return api.getUsersItem({ userId: id });
  });
};

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
