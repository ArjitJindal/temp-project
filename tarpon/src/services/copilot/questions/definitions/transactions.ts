import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import {
  InvestigationContext,
  TableQuestion,
  Variables,
} from '@/services/copilot/questions/types'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  paymentIdentifierQueryClickhouse,
} from '@/services/copilot/questions/definitions/util'
import {
  executeClickhouseQuery,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

type Transaction = {
  transactionId: string
  type: string
  timestamp: string
  transactionState: string
  originUserId: string
  originConsumerName: string
  originAmount: number
  originCurrency: string
  originCountry: string
  destinationUserId: string
  destinationConsumerName: string
  destinationAmount: number
  destinationCurrency: string
  destinationCountry: string
  reference: string
}

const clickhouseTransactionQuery = async (
  ctx: InvestigationContext,
  period: Period,
  clickhouseWhere: (ctx: InvestigationContext) => string = () => ``,
  page: number,
  pageSize: number
) => {
  const transactionsQuery = `
  SELECT id as transactionId,type,timestamp,transactionState,originUserId,originAmountDetails_transactionAmount as originAmount,originAmountDetails_transactionCurrency as originCurrency,originAmountDetails_country as originCountry,destinationUserId,destinationAmountDetails_transactionAmount as destinationAmount,destinationAmountDetails_transactionCurrency as destinationCurrency,destinationAmountDetails_country as destinationCountry,reference
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
    WHERE timestamp between {{ from }} and {{ to }} and ${clickhouseWhere(ctx)}
    `

  const query = `
  WITH txn AS (
    ${transactionsQuery}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  ),
  users as (
    SELECT
        DISTINCT u.id as userId,
        u.username
    FROM
        users_by_id u
        JOIN transactions t ON u.id = t.originUserId
        OR u.id = t.destinationUserId
  ) 
  SELECT
    txn.*,
    users.username as originConsumerName,
    users.username as destinationConsumerName
  FROM txn
  LEFT JOIN users ON txn.originUserId = users.userId
  `

  const countQuery = `
    SELECT count(*) as total from ${
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName
    }
    WHERE timestamp between {{ from }} and {{ to }} and ${clickhouseWhere(ctx)}
  `

  const [transactions, total] = await Promise.all([
    executeClickhouseQuery<Transaction[]>(ctx.tenantId, query, {
      from: period.from?.toString() ?? '',
      to: period.to?.toString() ?? '',
      userId: ctx.userId,
    }),
    executeClickhouseQuery<{ total: number }>(ctx.tenantId, countQuery, {
      from: period.from?.toString() ?? '',
      to: period.to?.toString() ?? '',
      userId: ctx.userId,
    }),
  ])

  const items = transactions.map((t) => {
    return [
      t.transactionId,
      t.type,
      t.timestamp,
      t.transactionState,
      t.originUserId,
      t.originConsumerName,
      t.originAmount,
      t.originCurrency,
      t.originCountry,
      t.destinationUserId,
      t.destinationConsumerName,
      t.destinationAmount,
      t.destinationCurrency,
      t.destinationCountry,
      t.reference,
    ]
  })

  return {
    items,
    total: total[0].total,
    rows: transactions,
  }
}

export const transactionQuestion = (
  questionId: QuestionId,
  title: (ctx: InvestigationContext, vars: Variables) => Promise<string>,
  clickhouseWhere: (ctx: InvestigationContext) => string = () => ``
): TableQuestion<Period> => ({
  type: 'TABLE',
  questionId,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title,
  headers: [
    { name: 'Transaction ID', columnType: 'ID' },
    { name: 'Transaction type', columnType: 'TAG' },
    { name: 'Timestamp', columnType: 'DATE_TIME' },
    { name: 'Last transaction state', columnType: 'TAG' },
    { name: 'Origin user ID', columnType: 'ID' },
    { name: 'Origin user', columnType: 'STRING' },
    { name: 'Origin amount', columnType: 'MONEY_AMOUNT' },
    { name: 'Origin currency', columnType: 'MONEY_CURRENCY' },
    { name: 'Origin country', columnType: 'COUNTRY' },
    { name: 'Destination user ID', columnType: 'ID' },
    { name: 'Destination user', columnType: 'STRING' },
    { name: 'Destination amount', columnType: 'MONEY_AMOUNT' },
    { name: 'Destination currency', columnType: 'MONEY_CURRENCY' },
    { name: 'Destination country', columnType: 'COUNTRY' },
    { name: 'Reference', columnType: 'STRING' },
  ],
  aggregationPipeline: async (ctx, { page, pageSize, ...period }) => {
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const { items, total, rows } = await clickhouseTransactionQuery(
      ctx,
      period,
      clickhouseWhere,
      page ?? 1,
      pageSize ?? 20
    )

    return {
      data: { items, total },
      summary: `There have been ${total} transactions for ${
        ctx.humanReadableId
      } ${humanReadablePeriod(period)}. ${
        total
          ? `For the transactions, ${calculatePercentageBreakdown(
              rows.map((t) => t.transactionState || '')
            )}.`
          : ``
      }`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
})

const UserTransactions = transactionQuestion(
  COPILOT_QUESTIONS.USER_TRANSACTIONS,
  async (ctx) => `Transactions for user ${ctx.userId}`,
  (ctx) => {
    const condition = ctx.userId
      ? `originUserId = '{{ userId }}' or destinationUserId = '{{ userId }}'`
      : paymentIdentifierQueryClickhouse(ctx.paymentIdentifier)
    return `(${condition})`
  }
)

const AlertTransactions = transactionQuestion(
  COPILOT_QUESTIONS.ALERT_TRANSACTIONS,
  async (ctx) => `Transactions for alert ${ctx.alertId}`,
  (ctx) => `id in ('${ctx.alert.transactionIds?.join("','")}')`
)

export const TransactionQuestions = [UserTransactions, AlertTransactions]
