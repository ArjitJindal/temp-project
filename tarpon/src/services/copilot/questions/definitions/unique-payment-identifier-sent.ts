import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { PaymentMethod } from '@/@types/openapi-internal/PaymentMethod'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const UniquePaymentIdentifierSent: TableQuestion<
  Period & { top: number }
> = {
  type: 'TABLE',
  questionId: 'Payment identifiers of receivers',
  title: (_, vars) => {
    return `Top ${
      vars.top
    } payment identifiers they have received ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }, { top, ...period }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ _id: { paymentMethodId: string; type: PaymentMethod } }>([
        {
          $match: { originUserId: userId, ...matchPeriod('timestamp', period) },
        },
        {
          $group: {
            _id: {
              paymentMethodId: '$destinationPaymentMethodId',
              type: '$destinationPaymentDetails.method',
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
        {
          $limit: top,
        },
      ])
      .toArray()

    return result.map((r) => {
      return [r._id.paymentMethodId, r._id.type]
    })
  },
  headers: [
    { name: 'Destination payment identifier', columnType: 'ID' },
    { name: 'Payment type', columnType: 'PAYMENT_METHOD' },
  ],
  variableOptions: {
    ...periodVars,
    top: 'INTEGER',
  },
  defaults: () => {
    return { top: 10 }
  },
}
