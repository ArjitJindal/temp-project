import { neverReturn } from '../lang';
import {
  ConsumerName,
  InternalBusinessUser,
  InternalConsumerUser,
  LegalEntity,
  MissingUser,
  UserDetails,
} from '@/apis';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { makeUrl } from '@/utils/routing';

export function formatConsumerName(name: ConsumerName | undefined): string {
  const result = [name?.firstName, name?.middleName, name?.lastName].filter(Boolean).join(' ');
  // todo: i18n
  if (result === '') {
    return '-';
  }
  return result;
}

export function getFullName(userDetails: UserDetails | undefined): string {
  return formatConsumerName(userDetails?.name);
}

export function businessName(legalEntity: LegalEntity): string {
  return legalEntity?.companyGeneralDetails?.legalName ?? '-';
}

export function getUserName(user?: TableUser | MissingUser | null): string {
  if (user == null || !('type' in user)) {
    return '-';
  }
  if (user.type === 'CONSUMER') {
    return getFullName(user.userDetails);
  }
  if (user.type === 'BUSINESS') {
    return businessName(user.legalEntity);
  }
  return neverReturn(user, '-');
}

export function getUserLink(user?: Pick<TableUser, 'type' | 'userId'> | null): string | undefined {
  if (user == null || !('type' in user)) {
    return undefined;
  }
  return makeUrl(`/users/list/:list/:id`, {
    list: user.type === 'CONSUMER' ? 'consumer' : 'business',
    id: user.userId,
  });
}

export function isExistedUser(
  user: InternalConsumerUser | InternalBusinessUser | MissingUser | null | undefined,
): user is InternalConsumerUser | InternalBusinessUser {
  return user != null && 'type' in user;
}
