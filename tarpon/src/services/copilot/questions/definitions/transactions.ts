import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const Transactions: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Transactions',
  title: (ctx, vars) => {
    return `Transactions ${humanReadablePeriod(vars)}`
  },
  headers: [
    {
      name: 'Transaction ID',
      columnType: 'ID',
    },
    {
      name: 'TRS score',
      columnType: 'NUMBER',
    },
    {
      name: 'Risk level',
      columnType: 'TAG',
    },
    {
      name: 'Transaction type',
      columnType: 'TAG',
    },
    {
      name: 'Timestamp',
      columnType: 'DATE_TIME',
    },
    {
      name: 'Last transaction state',
      columnType: 'TAG',
    },
    {
      name: 'Status',
      columnType: 'TAG',
    },
    {
      name: 'Origin user ID',
      columnType: 'ID',
    },
    {
      name: 'Origin payment identifier',
      columnType: 'STRING',
    },
    {
      name: 'Origin amount',
      columnType: 'NUMBER',
    },
    {
      name: 'Origin currency',
      columnType: 'STRING',
    },
    {
      name: 'Origin country',
      columnType: 'STRING',
    },
    {
      name: 'Destination user ID',
      columnType: 'ID',
    },
    {
      name: 'Destination payment identifier',
      columnType: 'STRING',
    },
    {
      name: 'Destination amount',
      columnType: 'NUMBER',
    },
    {
      name: 'Destination currency',
      columnType: 'STRING',
    },
    {
      name: 'Destination country',
      columnType: 'STRING',
    },
    {
      name: 'Referene',
      columnType: 'STRING',
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
      data: result.map((t) => {
        return [
          t.transactionId,
          t.arsScore?.arsScore,
          t.arsScore?.riskLevel,
          t.type,
          t.timestamp,
          t.transactionState,
          t.status,
          t.originUserId,
          t.originPaymentMethodId,
          t.originAmountDetails?.transactionAmount,
          t.originAmountDetails?.transactionCurrency,
          t.originAmountDetails?.country,
          t.destinationUserId,
          t.destinationPaymentMethodId,
          t.destinationAmountDetails?.transactionAmount,
          t.destinationAmountDetails?.transactionCurrency,
          t.destinationAmountDetails?.country,
          t.reference,
        ]
      }),
      summary: `There have been ${
        result.length
      } transactions for ${username} ${humanReadablePeriod(period)}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
