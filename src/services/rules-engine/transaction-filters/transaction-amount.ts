import { JSONSchemaType } from 'ajv'

import _ from 'lodash'
import {
  TransactionAmountRange,
  TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { checkTransactionAmountBetweenThreshold } from '../utils/transaction-rule-utils'
import { TransactionRuleFilter } from './filter'

export type TransactionAmountRuleFilterParameter = {
  transactionAmountRange?: TransactionAmountRange
}

export class TransactionAmountRuleFilter extends TransactionRuleFilter<TransactionAmountRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionAmountRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionAmountRange: TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA(),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (
      !this.parameters.transactionAmountRange ||
      _.isEmpty(this.parameters.transactionAmountRange)
    ) {
      return true
    }

    const isOriginAmountInRange = await checkTransactionAmountBetweenThreshold(
      this.transaction.originAmountDetails,
      this.parameters.transactionAmountRange
    )
    const isDestinationAmountInRange =
      await checkTransactionAmountBetweenThreshold(
        this.transaction.destinationAmountDetails,
        this.parameters.transactionAmountRange
      )
    return Boolean(isOriginAmountInRange || isDestinationAmountInRange)
  }
}
