import { neverReturn } from '../lang';
import {
  ConsumerName,
  InternalBusinessUser,
  InternalConsumerUser,
  KYCStatus,
  MissingUser,
  UserDetails,
} from '@/apis';
import { UserState } from '@/apis/models/UserState';
import { makeUrl } from '@/utils/routing';

export const USER_STATES: UserState[] = [
  'ACTIVE',
  'BLOCKED',
  'CREATED',
  'DORMANT',
  'SUSPENDED',
  'TERMINATED',
  'UNACCEPTABLE',
];

export const KYC_STATUSES: KYCStatus[] = [
  'SUCCESSFUL',
  'FAILED',
  'NOT_STARTED',
  'IN_PROGRESS',
  'MANUAL_REVIEW',
];

export function formatConsumerName(name: ConsumerName | undefined): string {
  const result = [name?.firstName, name?.middleName, name?.lastName].filter(Boolean).join(' ');
  // todo: i18n
  if (result === '') {
    return '(No name)';
  }
  return result;
}

export function getFullName(userDetails: UserDetails | undefined): string {
  return formatConsumerName(userDetails?.name);
}

export function businessName(user: InternalBusinessUser): string {
  return user.legalEntity?.companyGeneralDetails?.legalName;
}

export function getUserName(
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser | null,
) {
  if (user == null || !('type' in user)) {
    return '-';
  }
  if (user.type === 'CONSUMER') {
    return getFullName(user.userDetails);
  }
  if (user.type === 'BUSINESS') {
    return businessName(user);
  }
  return neverReturn(user, '-');
}

export function getUserLink(
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser | null,
): string | undefined {
  if (user == null || !('type' in user)) {
    return undefined;
  }
  return makeUrl(`/users/list/:list/:id`, {
    list: user.type === 'CONSUMER' ? 'consumer' : 'business',
    id: user.userId,
  });
}
