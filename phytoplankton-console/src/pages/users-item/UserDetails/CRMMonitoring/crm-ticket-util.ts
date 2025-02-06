import { dayjs } from '@/utils/dayjs';
import { CRMRecord } from '@/apis/models/CRMRecord';
import { FreshdeskTicketConversation } from '@/apis/models/FreshdeskTicketConversation';

export function getFirstConversation(item: CRMRecord) {
  return [
    {
      body_text: item.description_text,
      from_email: item.email,
      to_email: item.to_emails?.[0] ?? null,
      created_at: item.created_at,
      updated_at: item.updated_at,
      cc_emails: item.cc_emails ?? [],
    },
  ] as FreshdeskTicketConversation[];
}

export function hasConversations(item: CRMRecord) {
  const firstConv = getFirstConversation(item);
  const itemConv = item.conversations ?? [];
  return firstConv.length > 0 || itemConv.length > 0;
}

export function getRemainingDays(item: number | undefined) {
  if (!item) {
    return ' ';
  }

  const days = dayjs().diff(dayjs(item), 'days');

  if (days == 0) {
    return 'Today';
  } else if (days == 1) {
    return 'Yesterday';
  } else {
    return `${days} days ago`;
  }
}
