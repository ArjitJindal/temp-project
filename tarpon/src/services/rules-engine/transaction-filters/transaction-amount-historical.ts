import { JSONSchemaType } from 'ajv'

import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency'
import { TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { TransactionRuleFilter } from './filter'
import { transactionAmountRuleFilterPredicate } from './transaction-amount'
import { TransactionAmountRange } from '@/@types/rule/params'

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
      this.dynamoDb,
      this.parameters.transactionAmountRangeHistorical
    )
  }
}
