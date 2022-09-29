import { JSONSchemaType } from 'ajv'
import { mergeRuleSchemas } from '../utils/rule-schema-utils'
import TransactionAverageExceededBaseRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded-base'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'

type TransactionsAverageNumberExceededPartialParameters = {
  multiplierThreshold: number
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
          multiplierThreshold: {
            type: 'number',
            title: 'Maximum multiplier',
            nullable: false,
          },
        },
        required: ['multiplierThreshold'],
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
