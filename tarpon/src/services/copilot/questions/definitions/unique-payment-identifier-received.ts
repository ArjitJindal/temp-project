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

export const UniquePaymentIdentifierReceived: TableQuestion<
  Period & { top: number }
> = {
  type: 'TABLE',
  questionId: 'Payment identifiers of senders',
  title: (_, vars) => {
    return `Top ${
      vars.top
    } payment identifiers they have received from ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { tenantId, userId, username },
    { top, ...period }
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{
        _id: { paymentMethodId: string; type: PaymentMethod }
        amount: number
        count: number
      }>([
        {
          $match: {
            destinationUserId: userId,
            ...matchPeriod('timestamp', period),
          },
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
            amount: { $sum: '$originAmountDetails.transactionAmount' },
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

    return {
      data: result.map((r) => {
        return [r._id.paymentMethodId, r._id.type, r.count, r.amount]
      }),
      summary: `The top payment identifier that ${username} received money from was ${
        result.at(0)?._id.paymentMethodId
      } which was a ${result.at(0)?._id.type} method.`,
    }
  },
  headers: [
    { name: 'Destination payment identifier', columnType: 'ID' },
    { name: 'Payment type', columnType: 'PAYMENT_METHOD' },
    { name: 'Transaction Count', columnType: 'NUMBER' },
    { name: 'Total Amount', columnType: 'MONEY_AMOUNT' },
  ],
  variableOptions: {
    ...periodVars,
    top: 'INTEGER',
  },
  defaults: () => {
    return { top: 10 }
  },
}
