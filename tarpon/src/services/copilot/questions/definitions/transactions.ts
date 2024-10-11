import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import { uniq } from 'lodash'
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
} from '@/services/copilot/questions/definitions/util'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { formatConsumerName } from '@/utils/helpers'

export const transactionQuestion = (
  questionId: QuestionId,
  title: (ctx: InvestigationContext, vars: Variables) => Promise<string>,
  where: (ctx: InvestigationContext) => string = () => ``
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
  }
)

const AlertTransactions = transactionQuestion(
  COPILOT_QUESTIONS.ALERT_TRANSACTIONS,
  async (ctx) => `Transactions for alert ${ctx.alertId}`,
  (ctx) =>
    `WHERE t.transactionId in ('${ctx.alert.transactionIds?.join("','")}')`
)

const CaseTransactions = transactionQuestion(
  COPILOT_QUESTIONS.CASE_TRANSACTIONS,
  async (ctx) => `Transactions for case ${ctx.caseId}`,
  (ctx) =>
    `WHERE t.transactionId in ('${uniq(
      ctx._case.alerts?.flatMap((a) => a.transactionIds)
    )?.join("','")}')`
)

export const TransactionQuestions = [
  UserTransactions,
  AlertTransactions,
  CaseTransactions,
]
