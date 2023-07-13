import { JSONSchemaType } from 'ajv'
import TransactionAverageExceededBaseRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded-base'
import TransactionAverageAmountExceededRule from './transactions-average-amount-exceeded'
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

export default class TransactionAverageDailyAmountExceededRule extends TransactionAverageExceededBaseRule<TransactionsAverageAmountExceededParameters> {
  public static getSchema(): JSONSchemaType<TransactionsAverageAmountExceededParameters> {
    return TransactionAverageAmountExceededRule.getSchema()
  }

  protected getAvgMethod(): 'AMOUNT' | 'NUMBER' | 'DAILY_AMOUNT' {
    return 'DAILY_AMOUNT'
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
