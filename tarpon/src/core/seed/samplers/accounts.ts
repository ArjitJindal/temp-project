import { Account } from '@/services/accounts'

let accounts: Account[] = []

export const setAccounts = (accountsToSet: Account[]) => {
  accounts = accountsToSet
}

export const getAccounts = () => {
  return accounts
}
