import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import { PERCENT_SCHEMA } from '../utils/rule-parameter-schemas'
import TransactionsDeviationBaseRule, {
  TransactionsExceededParameters,
} from './transactions-exceeded-base'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { traceable } from '@/core/xray'

type TransactionsAverageNumberExceededPartialParameters = {
  multiplierThreshold: number
  valueThresholdPeriod1?: {
    min?: number
    max?: number
  }
}

export type TransactionsAverageNumberExceededParameters =
  TransactionsExceededParameters &
    TransactionsAverageNumberExceededPartialParameters

@traceable
export default class TransactionAverageNumberExceededRule extends TransactionsDeviationBaseRule<TransactionsAverageNumberExceededParameters> {
  protected getAggregatorMethod(): 'SUM' | 'AVG' {
    return 'AVG'
  }

  public static getSchema(): JSONSchemaType<TransactionsAverageNumberExceededParameters> {
    const baseSchema = TransactionsDeviationBaseRule.getBaseSchema()
    const partialSchema: JSONSchemaType<TransactionsAverageNumberExceededPartialParameters> =
      {
        type: 'object',
        properties: {
          multiplierThreshold: PERCENT_SCHEMA({
            title: 'Maximum multiplier (as a percentage)',
            description:
              'For example, specifying 200 (%) means that period 1 average should be twice as big as period 2 average to trigger the rule',
            maximum: 'NO_MAXIMUM',
          }),
          valueThresholdPeriod1: {
            type: 'object',
            title: 'Average number threshold (period 1)',
            description:
              "Rule doesn't trigger if average transactions number in period1 in less than 'Min' or more than 'Max'",
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
            'valueThresholdPeriod1',
            'checkSender',
            'checkReceiver',
          ],
        },
      }

    return mergeRuleSchemas<TransactionsAverageNumberExceededParameters>(
      baseSchema,
      partialSchema
    )
  }

  protected getAggregationType(): 'AMOUNT' | 'NUMBER' | 'DAILY_AMOUNT' {
    return 'NUMBER'
  }

  protected getMultiplierThresholds(): {
    currency: CurrencyCode
    value: number
  } {
    return {
      currency: 'STUB_CURRENCY' as CurrencyCode,
      value: this.parameters.multiplierThreshold,
    }
  }
}
