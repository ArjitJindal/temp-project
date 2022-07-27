import { neverReturn } from '../lang';
import { ConsumerName, InternalBusinessUser, InternalConsumerUser, UserDetails } from '@/apis';

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
  return user.legalEntity.companyGeneralDetails.legalName;
}

export function getUserName(user?: InternalConsumerUser | InternalBusinessUser) {
  if (user == null) {
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
