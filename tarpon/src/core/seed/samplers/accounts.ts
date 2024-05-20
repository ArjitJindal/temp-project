import { getRandomIntInclusive } from './prng'
import { Account } from '@/services/accounts'
import { Assignment } from '@/@types/openapi-internal/Assignment'

let accounts: Account[] = []

export const setAccounts = (accountsToSet: Account[]) => {
  accounts = accountsToSet
}

export const getRandomUser = (): Assignment => {
  const randomAccountIndex = getRandomIntInclusive(0, accounts.length - 1)

  return {
    assigneeUserId: accounts[randomAccountIndex]?.id,
    timestamp: Date.now(),
  }
}

export const getRandomUsers = (): Assignment[] | undefined => {
  if (accounts.length === 0) {
    return undefined
  }
  const randomAccountIndex = getRandomIntInclusive(0, accounts.length - 1)
  return [
    {
      assigneeUserId: accounts[randomAccountIndex]?.id,
      timestamp: Date.now(),
    },
  ]
}
