import { UserDetails } from '@/apis';

export function getFullName(userDetails: UserDetails | undefined): string {
  const result = [
    userDetails?.name.firstName,
    userDetails?.name.middleName,
    userDetails?.name.lastName,
  ]
    .filter((x) => x != null)
    .join(' ');
  // todo: i18n
  if (result === '') {
    return '(No name)';
  }
  return result;
}
