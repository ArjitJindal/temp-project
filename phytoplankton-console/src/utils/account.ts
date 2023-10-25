import { Account } from '@/apis';

export const getAccountUserName = (account: Account) => {
  return (account.name || account.email || account.id) + (account.blocked ? ' (Deleted)' : '');
};
