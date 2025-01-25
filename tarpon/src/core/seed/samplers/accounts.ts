import { Account } from '@/@types/openapi-internal/Account'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

let accounts: Account[] = []

export const setAccounts = (accountsToSet: Account[]) => {
  accounts = accountsToSet
}

export const getAccounts = () => {
  if (accounts.length === 0) {
    accounts = [
      {
        id: FLAGRIGHT_SYSTEM_USER,
        role: 'ADMIN',
        email: 'system@flagright.com',
        emailVerified: true,
        name: FLAGRIGHT_SYSTEM_USER,
        blocked: false,
      },
    ]
  }
  return accounts
}
