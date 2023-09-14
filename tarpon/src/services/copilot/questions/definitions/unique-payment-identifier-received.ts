import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { PaymentMethod } from '@/@types/openapi-internal/PaymentMethod'

export const UniquePaymentIdentifierReceived: TableQuestion<any> = {
  type: 'TABLE',
  questionId:
    'What are the top 10 payment identifiers they have received money from?',
  aggregationPipeline: async ({ tenantId, userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ _id: { paymentMethodId: string; type: PaymentMethod } }>([
        {
          $match: { destinationUserId: userId },
        },
        {
          $group: {
            _id: {
              paymentMethodId: '$originPaymentMethodId',
              type: '$originPaymentDetails.method',
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
          $limit: 10,
        },
      ])
      .toArray()

    return result.map((r) => {
      return [r._id.paymentMethodId, r._id.type]
    })
  },
  headers: [
    { name: 'Destination payment identifier', columnType: 'STRING' },
    { name: 'Payment type', columnType: 'STRING' },
  ],
  variableOptions: {},
}
