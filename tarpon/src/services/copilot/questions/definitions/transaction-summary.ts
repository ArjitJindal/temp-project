import { PropertiesQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TransactionsBuilder } from '@/services/copilot/attributes/transactions-attribute-builder'
import { AttributeSet } from '@/services/copilot/attributes/builder'
export const TransactionSummary: PropertiesQuestion<Period> = {
  type: 'PROPERTIES',
  questionId: 'Transaction insights',
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ username }, { ...period }) => {
    return `Transaction insights for ${username} ${humanReadablePeriod(period)}`
  },
  aggregationPipeline: async ({ user, tenantId, userId }, { ...period }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const transactions = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({
        ...matchPeriod('timestamp', period),
        $or: [{ originUserId: userId }, { destinationUserId: userId }],
      })
      .toArray()

    const attributes = new AttributeSet()
    const builder = new TransactionsBuilder()
    builder.build(attributes, { transactions, user })

    attributes.delete('transactionIds')
    const figures = [...attributes.entries()]
    return {
      data: figures.map(([key, value]) => {
        return {
          key,
          value: `${value}`,
        }
      }),
      summary: ``,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
