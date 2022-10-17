import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionAverageExceededBaseRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded-base'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { PERCENT_SCHEMA } from '@/services/rules-engine/utils/math-utils'

type TransactionsAverageNumberExceededPartialParameters = {
  multiplierThreshold: number
  averageThreshold?: {
    min?: number
    max?: number
  }
}

export type TransactionsAverageNumberExceededParameters =
  TransactionsAverageExceededParameters &
    TransactionsAverageNumberExceededPartialParameters

export default class TransactionAverageNumberExceededRule extends TransactionAverageExceededBaseRule<TransactionsAverageNumberExceededParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsAverageNumberExceededParameters> {
    const baseSchema = TransactionAverageExceededBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TransactionsAverageNumberExceededPartialParameters> =
      {
        type: 'object',
        properties: {
          multiplierThreshold: PERCENT_SCHEMA({
            title:
              'Maximum multiplier (as a percentage). For example, specifying 200 (%) means that period2 average should be twice as big as period1 average to trigger the rule',
            maximum: 'NO_MAXIMUM',
          }),
          averageThreshold: {
            type: 'object',
            title:
              "Rule doesn't trigger if average transactions number in period1 in less than 'Min' or more than 'Max' (as a percentage)",
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

    return mergeRuleSchemas<TransactionsAverageNumberExceededParameters>(
      baseSchema,
      partialSchema
    )
  }

  protected getAvgMethod(): 'AMOUNT' | 'NUMBER' {
    return 'NUMBER'
  }

  protected getMultiplierThresholds(): { [currency: string]: number } {
    return {
      STUB_CURRENCY: this.parameters.multiplierThreshold,
    }
  }
}
