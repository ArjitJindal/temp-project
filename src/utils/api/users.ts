import { InternalBusinessUser, UserDetails } from '@/apis';

export function getFullName(userDetails: UserDetails | undefined): string {
  const result = [
    userDetails?.name?.firstName,
    userDetails?.name?.middleName,
    userDetails?.name?.lastName,
  ]
    .filter(Boolean)
    .join(' ');
  // todo: i18n
  if (result === '') {
    return '(No name)';
  }
  return result;
}

export function businessName(user: InternalBusinessUser): string {
  return user.legalEntity.companyGeneralDetails.legalName;
}
