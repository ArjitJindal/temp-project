import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionAverageExceededBaseRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded-base'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'

type TransactionsAverageAmountExceededPartialParameters = {
  multiplierThresholds: {
    [currency: string]: number
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
          multiplierThresholds: {
            type: 'object',
            title: 'Maximum multiplier',
            additionalProperties: {
              type: 'integer',
              minimum: 1,
            },
            required: [],
            nullable: false,
          },
        },
        required: ['multiplierThresholds'],
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
    return this.parameters.multiplierThresholds
  }
}
