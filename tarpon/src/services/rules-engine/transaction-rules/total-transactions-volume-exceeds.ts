import { JSONSchemaType } from 'ajv'
import {
  CURRENCY_SCHEMA,
  PERCENT_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionsDeviationBaseRule, {
  TransactionsExceededParameters,
} from './transactions-exceeded-base'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { traceable } from '@/core/xray'

type TransactionVolumeExceedsTwoPeriodsRulePartialParams = {
  multiplierThreshold: {
    currency: string
    value: number
  }
  valueThresholdPeriod1?: {
    min?: number
    max?: number
  }
  excludePeriod1?: boolean
}

export type TransactionVolumeExceedsTwoPeriodsRuleParameters =
  TransactionVolumeExceedsTwoPeriodsRulePartialParams &
    TransactionsExceededParameters

@traceable
export class TransactionVolumeExceedsTwoPeriodsRule extends TransactionsDeviationBaseRule<TransactionVolumeExceedsTwoPeriodsRuleParameters> {
  public static getSchema(): JSONSchemaType<TransactionVolumeExceedsTwoPeriodsRulePartialParams> {
    const baseSchema = TransactionsDeviationBaseRule.getBaseSchema()

    const partialSchema: JSONSchemaType<TransactionVolumeExceedsTwoPeriodsRulePartialParams> =
      {
        type: 'object',
        properties: {
          multiplierThreshold: {
            type: 'object',
            properties: {
              currency: CURRENCY_SCHEMA({
                title: 'Currency code to count amount',
                description:
                  'All the transactions in this currencies are converted to this currency before calculating the sum',
              }),
              value: PERCENT_SCHEMA({
                title: 'Multiplier as a percentage',
                maximum: 'NO_MAXIMUM',
                description:
                  'For example, specifying 200 (%) means that the period 1 sum should be twice as big as period 2 sum to trigger the rule',
              }),
            },
            required: ['currency', 'value'],
            nullable: false,
          },
          valueThresholdPeriod1: {
            type: 'object',
            title: 'Total amount threshold (period 1)',
            description:
              "Rule doesn't trigger if the total amount in period 1 is less than 'Min' or more than 'Max'",
            properties: {
              min: {
                type: 'number',
                title: 'Min',
                description: 'Minimum total amount in period 1',
                nullable: true,
                minimum: 0,
              } as const,
              max: {
                type: 'number',
                title: 'Max',
                description: 'Maximum total amount in period 1',
                nullable: true,
                minimum: 0,
              } as const,
            },
            required: [],
            nullable: true,
          },
          excludePeriod1: {
            type: 'boolean',
            title:
              'Exclude transactions in period1 from period2 (Recommended: enabled)',
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

    return mergeRuleSchemas<TransactionVolumeExceedsTwoPeriodsRulePartialParams>(
      baseSchema,
      partialSchema
    )
  }

  protected getAggregationType(): 'AMOUNT' | 'NUMBER' | 'DAILY_AMOUNT' {
    return 'AMOUNT'
  }

  protected getAggregatorMethod(): 'SUM' | 'AVG' {
    return 'SUM'
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
