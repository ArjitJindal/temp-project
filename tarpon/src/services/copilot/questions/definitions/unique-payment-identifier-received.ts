import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'

export const UniquePaymentIdentifierReceived: TableQuestion<
  Period & { top: number }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS_OF_RECEIVERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top ${
      vars.top
    } payment identifiers they have received from ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ userId, username }, { top, ...period }) => {
    const result = await executeSql<{
      method: string
      count: number
      sum: number
      originPaymentDetails: PaymentDetails
    }>(
      `
    select
      first(t.originPaymentDetails.method) as originPaymentDetails,
      count(*) as count,
      sum(t.originAmountDetails.transactionAmount) as sum,
      t.originPaymentDetails
    from
      transactions t
    where
      t.destinationUserId = :userId
      and t.timestamp between :from and :to
    group by
      t.originPaymentDetails
    order by
      sum desc
    limit :top
    `,
      {
        userId,
        ...sqlPeriod(period),
        top,
      }
    )

    return {
      data: result.map((r) => {
        return [
          getPaymentMethodId(r.originPaymentDetails),
          r.method,
          r.count,
          r.sum,
        ]
      }),
      summary: `The top payment identifier that ${username} received money from was ${getPaymentMethodId(
        result.at(0)?.originPaymentDetails
      )} which was a ${result.at(0)?.method} method.`,
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
