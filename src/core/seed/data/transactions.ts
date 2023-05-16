import { data as users } from './users'
import { sampleTransaction } from '@/core/seed/samplers/transaction'
import { sampleTag } from '@/core/seed/samplers/tag'
import { sampleCountry } from '@/core/seed/samplers/countries'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { pickRandom, prng, randomFloat, randomInt } from '@/utils/prng'
import { randomRules, rules } from '@/core/seed/data/rules'
import { sampleCurrency } from '@/core/seed/samplers/currencies'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'

const TXN_COUNT = 10000
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

    const transactionId = `T-${i + 1}`
    const timestamp = sampleTimestamp(i)
    const fullTransaction: InternalTransaction = {
      ...transaction,
      type: type,
      timestamp,
      transactionId,
      originUserId,
      destinationUserId,
      status: status,
      hitRules,
      arsScore: {
        transactionId,
        createdAt: timestamp,
        originUserId,
        destinationUserId,
        riskLevel: pickRandom(RISK_LEVEL1S),
        arsScore: randomFloat(100),
      },
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

const transactions: InternalTransaction[] = []

const init = () => {
  if (transactions.length > 0) {
    return
  }
  const data = generate()
  for (const transaction of data) {
    transactions.push(transaction)
  }
}

export { init, generate, transactions }
