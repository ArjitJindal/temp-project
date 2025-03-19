import { dayjs } from '@/utils/dayjs';
import { CRMRecord } from '@/apis/models/CRMRecord';
import { NangoConversation } from '@/apis';

export function getFirstConversation(item: CRMRecord): NangoConversation[] {
  return [
    {
      bodyText: item.data.descriptionText,
      fromEmail: item.data.email,
      toEmail: item.data.toEmails?.[0] ?? undefined,
      createdAt: item.data.createdAt,
      updatedAt: item.data.updatedAt,
      ccEmails: item.data.ccEmails ?? [],
    },
  ];
}

export function hasConversations(item: CRMRecord) {
  const firstConv = getFirstConversation(item);
  const itemConv = item.data.conversations ?? [];
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
