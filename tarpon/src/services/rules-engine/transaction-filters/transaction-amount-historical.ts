import { JSONSchemaType } from 'ajv'

import {
  TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA,
  TransactionAmountRange,
} from '../utils/rule-parameter-schemas'
import { DEFAULT_CURRENCY_KEYWORD } from '../transaction-rules/library'
import { TransactionRuleFilter } from './filter'
import { transactionAmountRuleFilterPredicate } from './transaction-amount'

export type TransactionAmountHistoricalRuleFilterParameter = {
  transactionAmountRangeHistorical?: TransactionAmountRange
}

export class TransactionAmountHistoricalRuleFilter extends TransactionRuleFilter<TransactionAmountHistoricalRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<TransactionAmountHistoricalRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        transactionAmountRangeHistorical:
          TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA({
            uiSchema: {
              group: 'transaction_historical',
            },
          }),
      },
    }
  }

  public static getDefaultValues(): TransactionAmountHistoricalRuleFilterParameter {
    return {
      transactionAmountRangeHistorical: {
        [DEFAULT_CURRENCY_KEYWORD]: {},
      },
    }
  }

  public async predicate(): Promise<boolean> {
    return transactionAmountRuleFilterPredicate(
      this.transaction,
      this.parameters.transactionAmountRangeHistorical
    )
  }
}
