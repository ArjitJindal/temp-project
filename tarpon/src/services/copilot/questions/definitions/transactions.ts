import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import {
  InvestigationContext,
  TableQuestion,
  Variables,
} from '@/services/copilot/questions/types'
import {
  calculatePercentageBreakdown,
  humanReadablePeriod,
  transactionPaymentIdentifierQuerySQL,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
  paymentIdentifierQueryClickhouse,
} from '@/services/copilot/questions/definitions/util'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { formatConsumerName } from '@/utils/helpers'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { replacePlaceholders } from '@/utils/viper'
import { hasFeature } from '@/core/utils/context'

const athenaTransactionQuery = async (
  ctx: InvestigationContext,
  period: Period,
  where: (ctx: InvestigationContext) => string = () => ``,
  page: number,
  pageSize: number
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
  t.transactionId as transactionId,
  t.type as type,
  t.timestamp as timestamp,
  t.transactionState as transactionState,
  t.originUserId as originUserId,
  t.originAmountDetails as originAmountDetails,
  t.destinationUserId as destinationUserId,
  t.destinationAmountDetails as destinationAmountDetails,
  t.reference as reference,
  origin.userDetails.name as originConsumerName,
  origin.legalEntity.companyGeneralDetails.legalName as originBusinessName,
  destination.userDetails.name as destinationConsumerName,
  destination.legalEntity.companyGeneralDetails.legalName as destinationBusinessName
from
  transactions t
  left join users origin on t.originUserId = origin.userId
  left join users destination on t.destinationUserId = destination.userId
        ${where(ctx)} and t.timestamp between :from and :to
      `,
    {
      userId: ctx.userId,
      ...ctx.paymentIdentifier,
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
    items,
    total,
    rows,
  }
}

const clickhouseTransactionQuery = async (
  ctx: InvestigationContext,
  period: Period,
  clickhouseWhere: (ctx: InvestigationContext) => string = () => ``,
  page: number,
  pageSize: number
) => {
  const transactionsQuery = `
  SELECT
      id as transactionId,
      type,
      timestamp,
      transactionState,
      originUserId,
      originAmountDetails_transactionAmount as originAmount,
      originAmountDetails_transactionCurrency as originCurrency,
      originAmountDetails_country as originCountry,
      destinationUserId,
      destinationAmountDetails_transactionAmount as destinationAmount,
      destinationAmountDetails_transactionCurrency as destinationCurrency,
      destinationAmountDetails_country as destinationCountry,
      reference
    FROM transactions FINAL
    WHERE timestamp between :from and :to and ${clickhouseWhere(ctx)}
    `

  const query = `
  WITH transactions AS (
    ${transactionsQuery}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
),
 users as (
  SELECT
    id as userId,
    username
  FROM users FINAL
  WHERE id in (SELECT originUserId FROM transactions)
    OR id in (SELECT destinationUserId FROM transactions)
) SELECT
  transactions.*,
  users.username as originConsumerName,
  users.username as destinationConsumerName
FROM transactions
LEFT JOIN users ON transactions.originUserId = users.userId

`

  const countQuery = replacePlaceholders(
    `
    SELECT count(*) from transactions 
    WHERE timestamp between :from and :to and ${clickhouseWhere(ctx)}
    `,
    {
      ...sqlPeriod(period),
      userId: ctx.userId,
    }
  )
  const formattedQuery = replacePlaceholders(query, {
    userId: ctx.userId,
    ...sqlPeriod(period),
  })

  const [transactions, total] = await Promise.all([
    executeClickhouseQuery<any>(ctx.tenantId, formattedQuery, {}),
    executeClickhouseQuery<{ total: number }>(ctx.tenantId, countQuery, {}),
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
  where: (ctx: InvestigationContext) => string = () => ``,
  clickhouseWhere: (ctx: InvestigationContext) => string = () => ``
): TableQuestion<Period> => ({
  type: 'TABLE',
  questionId,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title,
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
  aggregationPipeline: async (ctx, { page, pageSize, ...period }) => {
    const { items, total, rows } = !hasFeature('CLICKHOUSE_ENABLED')
      ? await athenaTransactionQuery(
          ctx,
          period,
          where,
          page ?? 1,
          pageSize ?? 20
        )
      : await clickhouseTransactionQuery(
          ctx,
          period,
          clickhouseWhere,
          page ?? 1,
          pageSize ?? 20
        )

    return {
      data: {
        items,
        total,
      },
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
      ? `t.originUserId = :userId or t.destinationUserId = :userId`
      : transactionPaymentIdentifierQuerySQL(ctx.paymentIdentifier)
    return `WHERE (${condition})`
  },
  (ctx) => {
    const condition = ctx.userId
      ? `originUserId = :userId or destinationUserId = :userId`
      : paymentIdentifierQueryClickhouse(ctx.paymentIdentifier)
    return `(${condition})`
  }
)

const AlertTransactions = transactionQuestion(
  COPILOT_QUESTIONS.ALERT_TRANSACTIONS,
  async (ctx) => `Transactions for alert ${ctx.alertId}`,
  (ctx) =>
    `WHERE t.transactionId in ('${ctx.alert.transactionIds?.join("','")}')`,
  (ctx) => `id in ('${ctx.alert.transactionIds?.join("','")}')`
)

export const TransactionQuestions = [UserTransactions, AlertTransactions]
