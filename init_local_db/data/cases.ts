import transactions from './transactions'
import users from './users'
import { sampleTransactionCase, sampleUserCase } from './samplers/cases'
import { sampleTimestamp } from './samplers/timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { prng } from '@/utils/prng'

const data: Case[] = []

const random = prng(1)

for (let i = 0; i < 2; i += 1) {
  data.push({
    ...sampleTransactionCase(transactions[0].transactionId as string, random()),
    caseStatus: i === 0 ? 'CLOSED' : 'OPEN',
  })
}

for (let i = 0; i < 2; i += 1) {
  data.push({
    ...sampleUserCase(
      {
        transactionIds:
          i < 2
            ? transactions.map(({ transactionId }) => transactionId as string)
            : [],
        user:
          i === 0
            ? {
                origin: users[0],
              }
            : {
                destination: users[0],
              },
      },
      random()
    ),
    createdTimestamp: sampleTimestamp(1) - 3600 * 1000 * i,
  })
}

export = data
