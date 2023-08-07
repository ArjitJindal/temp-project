import { data as users } from './users'
import { transactions } from '@/core/seed/data/transactions'
import { sampleTransactionUserCase } from '@/core/seed/samplers/cases'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const data: Case[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  for (let i = 0; i < users.length; i += 1) {
    const user = users[i]
    const transactionsForUserAsOrigin: InternalTransaction[] =
      transactions.filter((t) => {
        return t.originUserId === user.userId
      })
    const transactionsForUserADestination: InternalTransaction[] =
      transactions.filter((t) => {
        return t.destinationUserId === user.userId
      })
    const destinationCase: Case = {
      ...sampleTransactionUserCase(
        {
          transactions: transactionsForUserADestination,
          userId: user.userId,
          destination: user,
        },
        i * 0.001
      ),
      createdTimestamp: sampleTimestamp(1) - 3600 * 1000 * i,
    }

    const originCase: Case = {
      ...sampleTransactionUserCase(
        {
          transactions: transactionsForUserAsOrigin,
          userId: user.userId,
          origin: user,
        },
        i * 0.001
      ),
      createdTimestamp: sampleTimestamp(1) - 3600 * 1000 * i,
    }

    if (destinationCase.alerts && destinationCase.alerts?.length > 0) {
      data.push(destinationCase)
    }
    if (originCase.alerts && originCase.alerts?.length > 0) {
      data.push(originCase)
    }
  }
}

export { init, data }
