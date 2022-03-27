import { User } from '@auth0/auth0-react';

export function isFlagrightUser(user: User): boolean {
  return user['https://flagright.com/tenantId'] === 'flagright';
}
