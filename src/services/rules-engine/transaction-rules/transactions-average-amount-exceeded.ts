import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionAverageExceededBaseRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded-base'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { PERCENT_SCHEMA } from '@/services/rules-engine/utils/math-utils'
import { CURRENCY_SCHEMA } from '@/services/rules-engine/utils/currencies-utils'

type TransactionsAverageAmountExceededPartialParameters = {
  multiplierThreshold: {
    currency: string
    value: number
  }
  averageThreshold?: {
    min?: number
    max?: number
  }
}

export type TransactionsAverageAmountExceededParameters =
  TransactionsAverageExceededParameters &
    TransactionsAverageAmountExceededPartialParameters

export default class TransactionAverageAmountExceededRule extends TransactionAverageExceededBaseRule<TransactionsAverageAmountExceededParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsAverageAmountExceededParameters> {
    const baseSchema = TransactionAverageExceededBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TransactionsAverageAmountExceededPartialParameters> =
      {
        type: 'object',
        properties: {
          multiplierThreshold: {
            type: 'object',
            title: 'Maximum multiplier',
            properties: {
              currency: CURRENCY_SCHEMA({
                title:
                  'Currency code to count amount. All the transactions in other currencies are converted to this currency before calculating the average',
              }),
              value: PERCENT_SCHEMA({
                title:
                  'Multiplier as a percentage. For example, specifying 200 (%) means that period2 average should be twice as big as period1 average to trigger the rule',
                maximum: 'NO_MAXIMUM',
              }),
            },
            required: ['currency', 'value'],
            nullable: false,
          },
          averageThreshold: {
            type: 'object',
            title:
              "Rule doesn't trigger if average transactions amount in period1 in less than 'Min' or more than 'Max' (in percentages)",
            properties: {
              min: PERCENT_SCHEMA({ title: 'Min', maximum: 'NO_MAXIMUM' }),
              max: PERCENT_SCHEMA({ title: 'Max', maximum: 'NO_MAXIMUM' }),
            },
            required: [],
            nullable: true,
          },
        },
        required: ['multiplierThreshold'],
        'ui:schema': {
          'ui:order': [
            'period1',
            'period2',
            'excludePeriod1',
            'multiplierThreshold',
            'transactionsNumberThreshold',
            'transactionsNumberThreshold2',
            'averageThreshold',
            'checkSender',
            'checkReceiver',
            'ageRange',
            'userType',
            'paymentMethod',
            'transactionState',
            'transactionTypes',
          ],
        },
      }
    return mergeRuleSchemas<TransactionsAverageAmountExceededParameters>(
      baseSchema,
      partialSchema
    )
  }

  protected getAvgMethod(): 'AMOUNT' | 'NUMBER' {
    return 'AMOUNT'
  }

  protected getMultiplierThresholds(): { [currency: string]: number } {
    return {
      [this.parameters.multiplierThreshold.currency]:
        this.parameters.multiplierThreshold.value,
    }
  }
}
