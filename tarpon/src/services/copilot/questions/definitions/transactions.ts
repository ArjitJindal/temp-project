import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { formatConsumerName } from '@/utils/helpers'

export const Transactions: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.TRANSACTIONS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (ctx, vars) => {
    return `Transactions ${humanReadablePeriod(vars)}`
  },
  headers: [
    {
      name: 'Transaction ID',
      columnType: 'ID',
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
      name: 'Origin user ID',
      columnType: 'ID',
    },
    {
      name: 'Origin user',
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
      name: 'Destination user',
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
      name: 'Reference',
      columnType: 'STRING',
    },
  ],
  aggregationPipeline: async (
    { userId, username },
    { page, pageSize, ...period }
  ) => {
    const { rows, total } = await paginatedSqlQuery<
      Transaction & {
        originBusinessName?: string
        destinationBusinessName?: string
        originConsumerName: ConsumerName
        destinationConsumerName: ConsumerName
      }
    >(
      `select
  t.transactionId,
  t.type,
  t.timestamp,
  t.transactionState,
  t.originUserId,
  t.originAmountDetails,
  t.destinationUserId,
  t.destinationAmountDetails,
  t.reference,
  origin.userDetails.name as originConsumerName,
  origin.legalEntity.companyGeneralDetails.legalName as originBusinessName,
  destination.userDetails.name as destinationConsumerName,
  destination.legalEntity.companyGeneralDetails.legalName as destinationBusinessName
from
  transactions t
  join users origin on t.originUserId = origin.userId
  join users destination on t.destinationUserId = destination.userId
        where t.timestamp between :from and :to
        and (t.originUserId = :userId or t.destinationUserId = :userId)
      `,
      {
        userId,
        ...sqlPeriod(period),
      },
      page,
      pageSize
    )

    const items = rows.map((t) => {
      return [
        t.transactionId,
        t.type,
        t.timestamp,
        t.transactionState,
        t.originUserId,
        t.originConsumerName
          ? formatConsumerName(t.originConsumerName)
          : t.originBusinessName,
        t.originAmountDetails?.transactionAmount,
        t.originAmountDetails?.transactionCurrency,
        t.originAmountDetails?.country,
        t.destinationUserId,
        t.destinationConsumerName
          ? formatConsumerName(t.destinationConsumerName)
          : t.destinationBusinessName,
        t.destinationAmountDetails?.transactionAmount,
        t.destinationAmountDetails?.transactionCurrency,
        t.destinationAmountDetails?.country,
        t.reference,
      ]
    })
    return {
      data: {
        items,
        total,
      },
      summary: `There have been ${total} transactions for ${username} ${humanReadablePeriod(
        period
      )}.  For the transactions, ${calculatePercentageBreakdown(
        rows.map((t) => t.transactionState || '')
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
