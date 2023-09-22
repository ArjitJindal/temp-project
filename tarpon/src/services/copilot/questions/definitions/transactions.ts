import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodDefaults,
} from '@/services/copilot/questions/definitions/util'

export const Transactions: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Transactions',
  title: (ctx, vars) => {
    return `Transactions ${humanReadablePeriod(vars)}`
  },
  headers: [
    {
      name: 'ID',
      columnType: 'STRING',
    },
    {
      name: 'Amount',
      columnType: 'NUMBER',
    },
    {
      name: 'Timestamp',
      columnType: 'DATE_TIME',
    },
  ],
  aggregationPipeline: async ({ tenantId, userId, username }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({
        ...matchPeriod('timestamp', period),
        $or: [{ originUserId: userId }, { destinationUserId: userId }],
      })
      .toArray()

    return {
      data: result.map((r) => {
        return [
          r.transactionId,
          r.originAmountDetails?.transactionAmount,
          r.timestamp,
        ]
      }),
      summary: `There have been ${
        result.length
      } transactions for ${username} ${humanReadablePeriod(period)}.`,
    }
  },
  variableOptions: {},
  defaults: () => {
    return periodDefaults()
  },
}
