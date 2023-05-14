import users from './users'
import { sampleTransaction } from '@/core/seed/samplers/transaction'
import { sampleTag } from '@/core/seed/samplers/tag'
import { sampleCountry } from '@/core/seed/samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { prng, randomInt } from '@/utils/prng'
import { randomRules, rules } from '@/core/seed/data/rules'
import { sampleCurrency } from '@/core/seed/samplers/currencies'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'

const TXN_COUNT = 100000
const generator = function* (seed: number): Generator<InternalTransaction> {
  for (let i = 0; i < TXN_COUNT; i += 1) {
    const random = prng(seed * i)
    const type =
      random() < 0.24 ? 'TRANSFER' : random() < 0.95 ? 'REFUND' : 'WITHDRAWAL'
    const status =
      random() < 0.24 ? 'BLOCK' : random() < 0.95 ? 'ALLOW' : 'FLAG'
    const transaction = sampleTransaction(i)
    const hitRules = randomRules()
    const originUserId = users[randomInt(random(), users.length)].userId

    const withoutOrigin = users.filter((u) => u.userId !== originUserId)
    const destinationUserId =
      withoutOrigin[randomInt(random(), withoutOrigin.length)].userId

    const fullTransaction: InternalTransaction = {
      ...transaction,
      type: type,
      timestamp: sampleTimestamp(i),
      transactionId: `T-${i + 1}`,
      originUserId,
      destinationUserId,
      status: status,
      hitRules,
      executedRules: rules,
      originAmountDetails: {
        country: sampleCountry(i),
        transactionCurrency: sampleCurrency(i),
        transactionAmount:
          status === 'BLOCK'
            ? Math.round(random() * 5000)
            : Math.round(random() * 1000),
      },
      destinationAmountDetails: {
        country: sampleCountry(i + 1),
        transactionCurrency: sampleCurrency(i + 1),
        transactionAmount: Math.round(random() * 1000),
      },
      tags: i < 3 ? [sampleTag(i)] : [],
    }
    yield fullTransaction
  }
}

const generate: () => Iterable<InternalTransaction> = () => generator(42)

const data = generate()

const transactions: InternalTransaction[] = []
for (const transaction of data) {
  transactions.push(transaction)
}

export { generate, transactions }
