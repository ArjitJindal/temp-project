import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const Transactions: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: 'Transactions',
  title: async (ctx, vars) => {
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
      columnType: 'MONEY_AMOUNT',
    },
    {
      name: 'Origin currency',
      columnType: 'MONEY_CURRENCY',
    },
    {
      name: 'Origin country',
      columnType: 'COUNTRY',
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
      columnType: 'MONEY_AMOUNT',
    },
    {
      name: 'Destination currency',
      columnType: 'MONEY_CURRENCY',
    },
    {
      name: 'Destination country',
      columnType: 'COUNTRY',
    },
    {
      name: 'Referene',
      columnType: 'STRING',
    },
  ],
  aggregationPipeline: async ({ tenantId, userId, username }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()

    console.log(period)
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
      } transactions for ${username} ${humanReadablePeriod(
        period
      )}.  For the transactions, ${calculatePercentageBreakdown(
        result.map((t) => t.status || '')
      )}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
