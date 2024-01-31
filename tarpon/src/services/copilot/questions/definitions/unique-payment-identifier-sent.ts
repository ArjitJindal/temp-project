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

export const UniquePaymentIdentifierSent: TableQuestion<
  Period & { top: number }
> = {
  type: 'TABLE',
  questionId: 'Payment identifiers of receivers',
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top ${
      vars.top
    } payment identifiers they have sent to ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ userId, username }, { top, ...period }) => {
    const result = await executeSql<{
      method: string
      count: number
      sum: number
      destinationPaymentDetails: PaymentDetails
    }>(
      `
    select
      first(t.destinationPaymentDetails.method) as destinationPaymentDetails,
      count(*) as count,
      sum(t.destinationAmountDetails.transactionAmount) as sum,
      t.destinationPaymentDetails
    from
      transactions t
    where
      t.originUserId = :userId
      and t.timestamp between :from and :to
    group by
      t.destinationPaymentDetails
    order by
      count desc
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
          getPaymentMethodId(r.destinationPaymentDetails),
          r.method,
          r.count,
          r.sum,
        ]
      }),
      summary: `The top payment identifier that ${username} sent money to was ${getPaymentMethodId(
        result.at(0)?.destinationPaymentDetails
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
