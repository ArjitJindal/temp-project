import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { PaymentMethod } from '@/@types/openapi-internal/PaymentMethod'

export const UniquePaymentIdentifierSent: TableQuestion<any> = {
  type: 'TABLE',
  questionId:
    'What are the top 10 payment identifiers they have send money to?',
  aggregationPipeline: async ({ tenantId, userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ _id: { paymentMethodId: string; type: PaymentMethod } }>([
        {
          $match: { originUserId: userId },
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
