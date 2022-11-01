import { JSONSchemaType } from 'ajv'

import _ from 'lodash'
import { TransactionRuleFilter } from './filter'
import dayjs from '@/utils/dayjs'

export type TransactionTimeWindowRuleFilterParameter = {
  transactionTimeWindow?: {
    from?: string // format: 00:00:00+00:00
    to?: string
  }
}

export default class TransactionTimeWindowRuleFilter extends TransactionRuleFilter<TransactionTimeWindowRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionTimeWindowRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionTimeWindow: {
          type: 'object',
          title: 'Transaction Time Window',
          properties: {
            from: {
              type: 'string',
              title: 'From (format: 00:00:00+00:00)',
              nullable: true,
            },
            to: {
              type: 'string',
              title: 'To (format: 00:00:00+00:00)',
              nullable: true,
            },
          },
          nullable: true,
        },
      },
    }
  }

  public async predicate(): Promise<boolean> {
    const { transactionTimeWindow } = this.parameters
    if (
      !transactionTimeWindow ||
      !transactionTimeWindow.from ||
      !transactionTimeWindow.to
    ) {
      return true
    }
    const transactionTime = dayjs(this.transaction.timestamp)
    const transactionDateString = transactionTime.format('YYYY-MM-DD')
    const fromTime = dayjs(
      `${transactionDateString}T${transactionTimeWindow.from}`
    )
    const toTime = dayjs(`${transactionDateString}T${transactionTimeWindow.to}`)
    return fromTime <= transactionTime && toTime >= transactionTime
  }
}
