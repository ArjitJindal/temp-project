import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import {
  CURRENCY_SCHEMA,
  PERCENT_SCHEMA,
} from '../utils/rule-parameter-schemas'
import TransactionAverageExceededBaseRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded-base'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

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
                title: 'Currency code to count amount',
                description:
                  'All the transactions in other currencies are converted to this currency before calculating the average',
              }),
              value: PERCENT_SCHEMA({
                title: 'Multiplier as a percentage',
                description:
                  'For example, specifying 200 (%) means that period 1 average should be twice as big as period 2 average to trigger the rule',
                maximum: 'NO_MAXIMUM',
              }),
            },
            required: ['currency', 'value'],
            nullable: false,
          },
          averageThreshold: {
            type: 'object',
            title: 'Average amount threshold (period 1)',
            description:
              "Rule doesn't trigger if average transactions amount in period1 in less than 'Min' or more than 'Max' (All the transactions in other currencies are converted to the above currency before calculating the average)",
            properties: {
              min: {
                type: 'number',
                title: 'Min',
                minimum: 0,
                nullable: true,
              } as const,
              max: {
                type: 'number',
                title: 'Max',
                minimum: 0,
                nullable: true,
              } as const,
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
          ],
        },
      }
    return mergeRuleSchemas<TransactionsAverageAmountExceededParameters>(
      baseSchema,
      partialSchema
    )
  }

  protected getAvgMethod(): 'AMOUNT' | 'NUMBER' | 'DAILY_AMOUNT' {
    return 'AMOUNT'
  }

  protected getMultiplierThresholds(): {
    currency: CurrencyCode
    value: number
  } {
    return {
      currency: this.parameters.multiplierThreshold.currency as CurrencyCode,
      value: this.parameters.multiplierThreshold.value,
    }
  }
}
