import { dayjs } from '@/utils/dayjs';
import { CRMTicket, NangoConversation } from '@/apis';

export function getFirstConversation(item: CRMTicket): NangoConversation[] {
  return [
    {
      bodyText: item.record.descriptionText,
      fromEmail: item.record.email,
      toEmail: item.record.toEmails?.[0] ?? undefined,
      createdAt: item.record.createdAt,
      updatedAt: item.record.updatedAt,
      ccEmails: item.record.ccEmails ?? [],
    },
  ];
}

export function hasConversations(item: CRMTicket) {
  const firstConv = getFirstConversation(item);
  const itemConv = item.record.conversations ?? [];
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
